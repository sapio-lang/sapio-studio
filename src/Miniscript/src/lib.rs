mod utils;

use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern {
    fn alert(s: &str);
}

use sapio_miniscript::*;
use core::str::FromStr;
#[wasm_bindgen]
pub fn compile(s:&str) -> Result<String, JsValue> {
    let pol = policy::Concrete::from_str(s).map_err(|e| e.to_string())?;
    let ms : Miniscript<String, Tap> = pol.compile().map_err(|e| e.to_string())?;
    Ok(ms.to_string())
}

pub fn taproot(frags:&Vec<&str>) -> Result<String, JsValue> {
    Ok("".into())
}