#![feature(once_cell)]
#![feature(result_flattening)]
mod utils;

use crate::bitcoin::Script;
use crate::bitcoin::XOnlyPublicKey;
use std::collections::HashMap;
use std::rc::Rc;
use std::sync::Arc;
use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
}

use core::str::FromStr;
use sapio_miniscript::*;
#[wasm_bindgen]
pub fn compile(s: &str) -> Result<String, JsValue> {
    let pol = policy::Concrete::from_str(s).map_err(|e| e.to_string())?;
    let ms: Miniscript<String, Tap> = pol.compile().map_err(|e| e.to_string())?;
    Ok(ms.to_string())
}
use bitcoin::secp256k1::VerifyOnly;
use sapio_miniscript::bitcoin::secp256k1::Secp256k1;
use std::sync::LazyLock;
static SECP: LazyLock<Secp256k1<VerifyOnly>> = LazyLock::new(|| Secp256k1::verification_only());
use bitcoin::util::taproot::TaprootSpendInfo;
use sapio_miniscript::TranslatePk;
#[wasm_bindgen]
#[derive(Debug)]
pub struct KeyTab {
    v: HashMap<String, String>,
}

#[wasm_bindgen]
impl KeyTab {
    pub fn new() -> KeyTab {
        KeyTab { v: HashMap::new() }
    }
    pub fn add(&mut self, k: String, v: String) {
        self.v.insert(k, v);
    }
}

#[wasm_bindgen]
#[derive(Debug)]
pub struct Fragments {
    v: Vec<String>,
}

#[wasm_bindgen]
impl Fragments {
    pub fn new() -> Self {
        Fragments { v: vec![] }
    }
    pub fn add(&mut self, s: String) {
        self.v.push(s)
    }
    pub fn add_all(&mut self, s: Box<[JsValue]>) -> bool {
        for v in s.iter() {
            if let Some(st) = v.as_string() {
                self.v.push(st)
            } else {
                return false;
            }
        }
        return true;
    }
}

#[wasm_bindgen]
pub fn taproot(frags: Fragments, keytab: &KeyTab) -> Result<String, JsValue> {
    let key = keytab
        .v
        .iter()
        .map(|(k, v)| XOnlyPublicKey::from_str(&v).map(|key| (k, key)))
        .collect::<Result<HashMap<_, _>, _>>()
        .map_err(|e| e.to_string())?;
    let ms: Vec<Miniscript<_, _>> = frags
        .v
        .iter()
        .map(|s| Miniscript::<String, Tap>::from_str(&s).map_err(|e| e.to_string()))
        .collect::<Result<Vec<Miniscript<_, _>>, _>>()
        .map_err(|e| e.to_string())?;

    let fpk: &Fn(&String) -> Result<XOnlyPublicKey, _> = &|k| {
        key.get(&k)
            .cloned()
            .ok_or_else(|| format!("Missing Key: {}", k))
    };
    let scripts: Vec<(u32, Script)> = ms
        .iter()
        .map(|s| {
            s.translate_pk(fpk, |k| Err(format!("No PKH Support for {}", k)))
                .map(|s: Miniscript<XOnlyPublicKey, Tap>| (1, s.encode()))
        })
        .collect::<Result<Vec<_>, _>>()?;
    use bitcoin::hashes::Hash;
    let nums: XOnlyPublicKey = {
        let mut b = bitcoin::hashes::sha256::Hash::hash("Hello".as_bytes()).into_inner();
        loop {
            if let Ok(k) = XOnlyPublicKey::from_slice(&b[..]) {
                break k;
            } else {
                b = bitcoin::hashes::sha256::Hash::hash(&b[..]).into_inner();
            }
        }
    };
    let tsi =
        TaprootSpendInfo::with_huffman_tree(&SECP, nums, scripts).map_err(|e| e.to_string())?;
    use sapio_miniscript::bitcoin::hashes::hex::ToHex;
    let js = serde_json::json! {{
        "tweak": tsi.tap_tweak().as_hash().to_hex(),
        "internal_key": tsi.internal_key().to_hex(),
        "merkle_root": tsi.merkle_root().map(|m|m.to_hex()),
        "scripts": tsi.as_script_map().iter().collect::<Vec<_>>(),
        "address":{
            "main": sapio_miniscript::bitcoin::Address::p2tr_tweaked(tsi.output_key(),    bitcoin::network::constants::Network::Bitcoin),
            "test": sapio_miniscript::bitcoin::Address::p2tr_tweaked(tsi.output_key(),    bitcoin::network::constants::Network::Testnet),
            "regtest": sapio_miniscript::bitcoin::Address::p2tr_tweaked(tsi.output_key(), bitcoin::network::constants::Network::Regtest),
            "signet": sapio_miniscript::bitcoin::Address::p2tr_tweaked(tsi.output_key(),  bitcoin::network::constants::Network::Signet),
        }
    }};
    Ok(serde_json::to_string_pretty(&js).map_err(|e| e.to_string())?)
}
