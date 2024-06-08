import { fakeContext } from './fakeContext';
import {
	ErgoBox,
	ErgoBoxes,
	Propositions,
	ReducedTransaction,
	Transaction,
	TransactionHintsBag,
	UnsignedTransaction,
	extract_hints,
} from 'ergo-lib-wasm-nodejs';
import { ErgoAddress } from '@fleet-sdk/core';
import { mnemonicToSeedSync } from 'bip39';
import * as wasm from 'ergo-lib-wasm-nodejs';
import type { EIP12UnsignedTransaction, SignedTransaction } from '@fleet-sdk/common';
import { POOL_MNEMONIC, POOL_ADDRESS } from './constants';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';

type JSONTransactionHintsBag = any;

function _removeSecrets(privateCommitments: JSONTransactionHintsBag, address: string) {
	let copy = JSON.parse(JSON.stringify(privateCommitments));

	const hBob = ErgoAddress.fromBase58(address).ergoTree.slice(6);
	for (var row in copy.publicHints) {
		copy.publicHints[row] = copy.publicHints[row].filter(
			(item: { hint: string; pubkey: { h: string } }) =>
				!(item.hint == 'cmtWithSecret' && item.pubkey.h == hBob),
		);
	}

	return copy;
}

export async function a(unsignedTx: EIP12UnsignedTransaction): Promise<any> {
	const proverBob = await getProver(POOL_MNEMONIC);
	let reducedTx = reducedFromUnsignedTx(unsignedTx);
	const privateCommitsPool = proverBob
		.generate_commitments_for_reduced_transaction(reducedTx)
		.to_json();

	let publicCommitsPool = _removeSecrets(privateCommitsPool, POOL_ADDRESS);

	return { privateCommitsPool, publicCommitsPool };
}

export async function b(
	unsignedTx: EIP12UnsignedTransaction,
	userMnemonic: string,
	userAddress: string,
	publicCommits: JSONTransactionHintsBag,
) {
	const publicBag = TransactionHintsBag.from_json(JSON.stringify(publicCommits));
	const proverAlice = await getProver(userMnemonic);
	const reducedTx = reducedFromUnsignedTx(unsignedTx);
	const initialCommitsAlice = proverAlice.generate_commitments_for_reduced_transaction(reducedTx);

	const combinedHints = TransactionHintsBag.empty();

	for (let i = 0; i < unsignedTx.inputs.length; i++) {
		combinedHints.add_hints_for_input(i, initialCommitsAlice.all_hints_for_input(i));
		combinedHints.add_hints_for_input(i, publicBag.all_hints_for_input(i));
	}

	const partialSignedTx = proverAlice.sign_reduced_transaction_multi(reducedTx, combinedHints);

	const hAlice = ErgoAddress.fromBase58(userAddress).ergoTree.slice(6);
	let extractedHints = extract_hints(
		partialSignedTx,
		fakeContext(wasm),
		ErgoBoxes.from_boxes_json(unsignedTx.inputs),
		ErgoBoxes.empty(),
		arrayToProposition([hAlice]),
		arrayToProposition([]),
	).to_json();
	return extractedHints;
}

//sign_tx_input_multi
//generate_commitments
//generate_commitments_for_reduced_transaction

export async function bMultiInput(
	unsignedTx: EIP12UnsignedTransaction,
	userMnemonic: string,
	userAddress: string,
	publicCommits: JSONTransactionHintsBag,
) {
	const publicBag = TransactionHintsBag.from_json(JSON.stringify(publicCommits));

	const proverAlice = await getProver(userMnemonic);
	const reducedTx = reducedFromUnsignedTx(unsignedTx);
	const initialCommitsAlice = proverAlice.generate_commitments_for_reduced_transaction(reducedTx);

	const unsignedTransaction = UnsignedTransaction.from_json(JSON.stringify(unsignedTx));

	const combinedHints = TransactionHintsBag.empty();

	for (let i = 0; i < unsignedTx.inputs.length; i++) {
		combinedHints.add_hints_for_input(i, initialCommitsAlice.all_hints_for_input(i));
		combinedHints.add_hints_for_input(i, publicBag.all_hints_for_input(i));
	}

	const partialSignedInput = proverAlice.sign_tx_input_multi(
		0,
		fakeContext(wasm),
		unsignedTransaction,
		ErgoBoxes.from_boxes_json(unsignedTx.inputs),
		ErgoBoxes.empty(),
		combinedHints,
	);

	const newUnsignedTx = unsignedTransaction.to_js_eip12();
	newUnsignedTx.transactionId = unsignedTransaction.id().to_str();
	newUnsignedTx.id = unsignedTransaction.id().to_str();

	newUnsignedTx.inputs[0].spendingProof = JSON.parse(
		partialSignedInput.spending_proof().to_json(),
	);

	const hAlice = ErgoAddress.fromBase58(userAddress).ergoTree.slice(6);

	//const proof = signedTx.inputs[0].spendingProof.proofBytes;
	//unsignedTx.inputs[0].spendingProof.proofBytes = proof;

	const proof = newUnsignedTx.inputs[0].spendingProof.proofBytes;

	// Example usage:
	const transaction = getNewTransactionFromProofs(unsignedTx, [proof]);

	let extractedHints = extract_hints(
		transaction, //Transaction.from_json(JSON.stringify(newUnsignedTx)),
		fakeContext(wasm),
		ErgoBoxes.from_boxes_json(unsignedTx.inputs),
		ErgoBoxes.empty(),
		arrayToProposition([hAlice]),
		arrayToProposition([]),
	).to_json();

	return extractedHints;
}

function getNewTransactionFromProofs(unsignedTx, proofs) {
	const uint8arrays = proofs.map(hexStringToUint8Array);
	const wasmUnsigned = UnsignedTransaction.from_json(JSON.stringify(unsignedTx));
	const transaction = Transaction.from_unsigned_tx(wasmUnsigned, uint8arrays);
	return transaction;
}

function hexStringToUint8Array(hexString) {
	if (hexString.length % 2 !== 0) {
		throw new Error('Invalid hex string');
	}

	const array = new Uint8Array(hexString.length / 2);

	for (let i = 0; i < hexString.length; i += 2) {
		array[i / 2] = parseInt(hexString.substr(i, 2), 16);
	}

	return array;
}

export async function cMultiInput(
	unsignedTx: EIP12UnsignedTransaction,
	privateCommitsPool: JSONTransactionHintsBag,
	hints: JSONTransactionHintsBag,
) {
	const hintsForBobSign = privateCommitsPool;
	for (var row in hintsForBobSign.publicHints) {
		for (var i = 0; i < hints.publicHints[row].length; i++) {
			hintsForBobSign.publicHints[row].push(hints.publicHints[row][i]);
		}
		for (var i = 0; i < hints.secretHints[row].length; i++) {
			hintsForBobSign.secretHints[row].push(hints.secretHints[row][i]);
		}
	}

	const convertedHintsForBobSign = TransactionHintsBag.from_json(JSON.stringify(hintsForBobSign));
	const proverBob = await getProver(POOL_MNEMONIC);
	const unsignedTransaction = UnsignedTransaction.from_json(JSON.stringify(unsignedTx));
	const signedInput = proverBob.sign_tx_input_multi(
		0,
		fakeContext(wasm),
		unsignedTransaction,
		ErgoBoxes.from_boxes_json(unsignedTx.inputs),
		ErgoBoxes.empty(),
		convertedHintsForBobSign,
	);

	const proof = JSON.parse(signedInput.spending_proof().to_json()).proofBytes;
	const transaction = getNewTransactionFromProofs(unsignedTx, [proof]);
	return transaction;
}

export async function c(
	unsignedTx: EIP12UnsignedTransaction,
	privateCommitsPool: JSONTransactionHintsBag,
	hints: JSONTransactionHintsBag,
) {
	const hintsForBobSign = privateCommitsPool;

	for (var row in hintsForBobSign.publicHints) {
		for (var i = 0; i < hints.publicHints[row].length; i++) {
			hintsForBobSign.publicHints[row].push(hints.publicHints[row][i]);
		}
		for (var i = 0; i < hints.secretHints[row].length; i++) {
			hintsForBobSign.secretHints[row].push(hints.secretHints[row][i]);
		}
	}
	const convertedHintsForBobSign = TransactionHintsBag.from_json(JSON.stringify(hintsForBobSign));

	const proverBob = await getProver(POOL_MNEMONIC);
	let signedTx = proverBob.sign_reduced_transaction_multi(
		reducedFromUnsignedTx(unsignedTx),
		convertedHintsForBobSign,
	);

	return signedTx;
}

function reducedFromUnsignedTx(unsignedTx: EIP12UnsignedTransaction) {
	const inputBoxes = ErgoBoxes.from_boxes_json(unsignedTx.inputs);
	const wasmUnsignedTx = UnsignedTransaction.from_json(JSON.stringify(unsignedTx));
	let context = fakeContext(wasm);
	let reducedTx = ReducedTransaction.from_unsigned_tx(
		wasmUnsignedTx,
		inputBoxes,
		ErgoBoxes.empty(),
		context,
	);
	return reducedTx;
}

export async function signTxMulti(
	unsignedTx: EIP12UnsignedTransaction,
	userMnemonic: string,
	userAddress: string,
): Promise<SignedTransaction> {
	const { privateCommitsPool, publicCommitsPool } = await a(unsignedTx);

	const extractedHints = await b(unsignedTx, userMnemonic, userAddress, publicCommitsPool);

	const signedTx = await c(unsignedTx, privateCommitsPool, extractedHints);

	return signedTx.to_js_eip12();
}

export async function signTxInput(
	mnemonic: string,
	tx: EIP12UnsignedTransaction,
	index: number,
): Promise<wasm.Input> {
	const prover = await getProver(mnemonic);

	const boxesToSign = tx.inputs;
	const boxes_to_spend = ErgoBoxes.empty();
	boxesToSign.forEach(box => {
		boxes_to_spend.add(ErgoBox.from_json(JSON.stringify(box)));
	});

	const signedInput = prover.sign_tx_input(
		index,
		fakeContext(wasm),
		wasm.UnsignedTransaction.from_json(JSON.stringify(tx)),
		boxes_to_spend,
		ErgoBoxes.empty(),
	);
	return signedInput;
}

function arrayToProposition(input: Array<string>): wasm.Propositions {
	const output = new Propositions();
	input.forEach(pk => {
		const proposition = Uint8Array.from(Buffer.from('cd' + pk, 'hex'));
		output.add_proposition_from_byte(proposition);
	});
	return output;
}

async function getProver(mnemonic: string): Promise<wasm.Wallet> {
	const secretKeys = new wasm.SecretKeys();
	secretKeys.add(getWalletAddressSecret(mnemonic));
	return wasm.Wallet.from_secrets(secretKeys);
}

const getWalletAddressSecret = (mnemonic: string, idx: number = 0) => {
	let seed = mnemonicToSeedSync(mnemonic);
	const path = calcPathFromIndex(idx);
	let bip32 = BIP32Factory(ecc);
	const extended = bip32.fromSeed(seed).derivePath(path);
	return wasm.SecretKey.dlog_from_bytes(Uint8Array.from(extended.privateKey ?? Buffer.from('')));
};

const RootPathWithoutIndex = "m/44'/429'/0'/0";
const calcPathFromIndex = (index: number) => `${RootPathWithoutIndex}/${index}`;
