// One-time wallet generation; do not run again on top of an existing wallet
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log("Private key:", privateKey);
console.log("Address:    ", account.address);
