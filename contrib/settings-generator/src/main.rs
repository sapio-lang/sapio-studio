#![allow(dead_code)]
#![allow(unused_variables)]
use sapio_bitcoin::secp256k1::PublicKey;
use schemars::schema::SchemaObject;
use schemars::JsonSchema;
use std::collections::HashMap;
use std::net::SocketAddrV4;
use std::path::Path;
use std::path::PathBuf;

struct FilePicker(PathBuf);
impl JsonSchema for FilePicker {
    fn json_schema(gen: &mut schemars::gen::SchemaGenerator) -> schemars::schema::Schema {
        let mut schema: SchemaObject = <Path>::json_schema(gen).into();
        schema.format = Some("data-url".to_owned());
        schema.into()
    }
    fn schema_name() -> std::string::String {
        "File".into()
    }
}
struct Password(String);
impl JsonSchema for Password {
    fn json_schema(gen: &mut schemars::gen::SchemaGenerator) -> schemars::schema::Schema {
        let mut schema: SchemaObject = <Path>::json_schema(gen).into();
        schema.format = Some("password".to_owned());
        schema.into()
    }
    fn schema_name() -> std::string::String {
        "Password".into()
    }
}

/// # Human Readable Nickname
/// e.g., my_hot_wallet
#[derive(JsonSchema)]
struct Nickname(String);

/// # Module Hash
/// (64 char hex)
#[derive(JsonSchema)]
struct ModuleHash(String);

/// # Public Key
/// e.g. xpubD6...
#[derive(JsonSchema)]
struct PK(String);

/// # Network Interface
/// e.g., hello.com:1010, 0.0.0.0:8080
#[derive(JsonSchema)]
struct IFace(String);

/// # Configuration Source
#[derive(JsonSchema)]
enum Preferences {
    /// # Here
    /// From Sapio-Studio,
    /// Configuration parameters done locally.
    Here {
        /// # Custom Plugin Mapping
        /// Map of nicknames to module hashes
        plugin_map: Vec<(Nickname, ModuleHash)>,
        /// # Use Emulation?
        /// Whether or not Emulation should be used
        use_emulation: bool,
        /// # Emulators
        /// Which Emulators to query?
        emulators: Vec<(PK, IFace)>,
        /// # Emulator Threshold (should set to # of emulators usually)
        /// How many Emulators must sign?
        threshold: u16,
    },
    /// # File
    /// Use a custom config file
    File {
        /// # Configuration File:
        config: FilePicker,
    },
    /// # Default
    /// Use sapio-cli's default settings configuration
    Default(()),
}

/// # Local Oracle
/// If Sapio Studio should run a local oracle, what seed file and interface to use.
#[derive(JsonSchema)]
enum LocalOracle {
    /// # Enabled
    /// An oracle will be run & managed by Sapio Studio
    Enabled {
        /// # Seed File
        file: FilePicker,
        /// # Interface
        /// (e.g. 0.0.0.0:8080)
        interface: SocketAddrV4,
    },

    /// # Disabled
    /// No oracle will be run.
    Disabled(()),
}

/// # sapio-cli Studio Configuration
#[derive(JsonSchema)]
struct SapioCliConfig {
    /// # Binary
    /// sapio-cli Binary Location
    sapio_cli: FilePicker,
    /// # Preferences
    /// How to configure the options for sapio-cli
    preferences: Preferences,
}

/// # Animation Speed
#[derive(JsonSchema)]
enum AnimationSpeed {
    /// # Enable Animation (ms)
    Enabled(#[schemars(range(min = 50, max = 5000))] u64),
    /// # Disable Animation
    Disabled(()),
}

/// # To Show Sats or Bitcoin
#[derive(JsonSchema)]
enum SatsOrBitcoin {
    /// # After Threshold
    /// min = 0, max = 100000000 (1 btc)
    BitcoinAfter(#[schemars(range(min = 0, max = 100000000))] u64),
    /// # Always Sats
    AlwaysSats(()),
    /// # Always Bitcoin
    AlwaysBitcoin(()),
}
/// # Display Settings
#[derive(JsonSchema)]
struct DisplaySettings {
    /// # Threshold at which to display Bitcoin () or Sats ()
    satoshis: SatsOrBitcoin,
    /// # Animation Speed
    /// The speed (in ms) to animate at
    animation_speed: AnimationSpeed,
    /// # Bitcoin Node Polling Frequency (seconds)
    node_polling_freq: u64,
}

/// # Bitcoin Settings
#[derive(JsonSchema)]
struct Bitcoin {
    /// # Which Network
    network: Network,
    /// # RPC Port
    port: u64,
    /// # Host
    /// E.g., 0.0.0.0 or mynode.com
    host: String,
    /// # Credentials
    auth: Auth,
}
#[derive(JsonSchema)]
pub enum Network {
    /// # Classic Bitcoin
    Bitcoin,
    /// # Bitcoin's testnet
    Testnet,
    /// # Bitcoin's signet
    Signet,
    /// # Bitcoin's regtest
    Regtest,
}

// note: remote type matched
/// # Auth File
#[derive(JsonSchema)]
enum Auth {
    /// # No Authentication
    None(()),
    /// # Username / Password
    UserPass(String, Password),
    /// # Cookie File
    CookieFile(FilePicker),
}

use schemars::schema_for;
fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("import {{ JSONSchema7 }} from 'json-schema';");
    let j = serde_json::json! {{
        "sapio_cli": schema_for!(SapioCliConfig),
        "local_oracle": schema_for!(LocalOracle),
        "display": schema_for!(DisplaySettings),
        "bitcoin": schema_for!(Bitcoin),
    }};
    println!(
        "export type schema_t = {{ {} }};",
        j.as_object()
            .unwrap()
            .keys()
            .map(|k| format!("\"{}\":JSONSchema7,", k))
            .collect::<Vec<String>>()
            .join("")
    );
    let js = serde_json::to_string_pretty(&j)?;
    println!("export const schemas : schema_t = {};", js);
    Ok(())
}
