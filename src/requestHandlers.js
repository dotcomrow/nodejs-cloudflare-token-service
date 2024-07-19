import { GCPBigquery } from "npm-gcp-bigquery";
import { GCPAccessToken } from "npm-gcp-token";
import { GCPUserInfo } from "npm-gcp-userinfo";

export async function handleDelete(env, account_id, query, itemId) {
  return {
    message: "Not implemented"
  };
}
export async function handlePost(env, account_id, body) {
  return {
    message: "Not implemented"
  };
}

export async function handlePut(env, account_id, body) {
  return {
    message: "Not implemented"
  }
}

export async function handleGet(env, account_id, query, itemId) {
  var returnObject = {};

  var bigquery_token = await new GCPAccessToken(
    env.GCP_BIGQUERY_CREDENTIALS
  ).getAccessToken("https://www.googleapis.com/auth/bigquery");

  var res = await GCPBigquery.query(
    env.GCP_BIGQUERY_PROJECT_ID,
    bigquery_token.access_token,
    "select format('[%s]', string_agg(to_json_string(p))) from database_dataset.user_preferences p where account_id = '" +
      account_id +
      "'"
  );
  if (!res.rows[0].f[0].v) {
    var initial_prefs = {};
    var keypair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"],
    );

    var publicKey = await crypto.subtle.exportKey(
      "jwk", 
      keypair.publicKey 
    ); 

    var privateKey = await crypto.subtle.exportKey(
      "jwk", 
      keypair.privateKey 
    ); 

    initial_prefs.publicKey = publicKey;
    initial_prefs.privateKey = privateKey;
    var res = await GCPBigquery.query(
      env.GCP_BIGQUERY_PROJECT_ID,
      bigquery_token.access_token,
      "insert into database_dataset.user_preferences (account_id, preferences, created_at, updated_at) values ('" +
        account_id +
        "', JSON '" + JSON.stringify(initial_prefs) + "', CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP())"
    );

    returnObject["preferences"] = {
      publicKey: publicKey
    };
    returnObject["account_id"] = account_id;
    returnObject["apiToken"] = await generateApiToken(env, publicKey);
    return returnObject;
  } else {
    var obj = JSON.parse(res.rows[0].f[0].v);
    obj[0].preferences.privateKey = null;
    delete obj[0].preferences.privateKey;
    returnObject["preferences"] = obj[0].preferences;
    returnObject["account_id"] = obj[0].account_id;
    returnObject["apiToken"] = await generateApiToken(env, obj[0].preferences.publicKey);
    return returnObject;
  }
}

async function generateApiToken(env, publicKey) {
  var pk = await crypto.subtle.importKey(
    "jwk",
    publicKey,
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt"],
  );
  var token = await crypto.subtle.encrypt(
    {
      name: "RSA-OAEP",
    },
      pk,
      new ArrayBuffer(env.GLOBAL_SHARED_SECRET)
    );
  return arrayBufferToBase64(token);
}

function arrayBufferToBase64( buffer ) {
  var binary = '';
  var bytes = new Uint8Array( buffer );
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
      binary += String.fromCharCode( bytes[ i ] );
  }
  return btoa( binary );
}