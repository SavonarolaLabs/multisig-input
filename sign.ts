import { fakeContext } from './fakeContext';
import {
	ErgoBox,
	ErgoBoxes,
	Input,
	Propositions,
	ReducedTransaction,
	SecretKey,
	SecretKeys,
	Transaction,
	TransactionHintsBag,
	UnsignedTransaction,
	Wallet,
	extract_hints,
	validate_tx,
	verify_tx_input_proof,
} from 'ergo-lib-wasm-nodejs';
import { ErgoAddress, Network } from '@fleet-sdk/core';
import { mnemonicToSeedSync } from 'bip39';
import type { EIP12UnsignedTransaction, SignedTransaction } from '@fleet-sdk/common';
import { POOL_MNEMONIC, POOL_ADDRESS } from './constants';
import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
import { compile } from '@fleet-sdk/compiler';

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

export async function signTxMultiStep1(unsignedTx: EIP12UnsignedTransaction): Promise<any> {
	const proverBob = await getProver(POOL_MNEMONIC);
	let reducedTx = reducedFromUnsignedTx(unsignedTx);
	const privateCommitsPool = proverBob
		.generate_commitments_for_reduced_transaction(reducedTx)
		.to_json();

	let publicCommitsPool = _removeSecrets(privateCommitsPool, POOL_ADDRESS);

	return { privateCommitsPool, publicCommitsPool };
}

export async function signTxMultiStep2(
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
		fakeContext(),
		ErgoBoxes.from_boxes_json(unsignedTx.inputs),
		ErgoBoxes.empty(),
		arrayToProposition([hAlice]),
		arrayToProposition([]),
	).to_json();
	return extractedHints;
}

export async function signInputMultiStep2(
	unsignedTx: EIP12UnsignedTransaction,
	userMnemonic: string,
	userAddress: string,
	publicCommits: JSONTransactionHintsBag,
	index: number,
): Promise<Input> {
	const publicBag = TransactionHintsBag.from_json(JSON.stringify(publicCommits));
	const proverAlice = await getProver(userMnemonic);
	const reducedTx = reducedFromUnsignedTx(unsignedTx);
	const initialCommitsAlice = proverAlice.generate_commitments_for_reduced_transaction(reducedTx);

	const combinedHints = TransactionHintsBag.empty();

	for (let i = 0; i < unsignedTx.inputs.length; i++) {
		combinedHints.add_hints_for_input(i, initialCommitsAlice.all_hints_for_input(i));
		combinedHints.add_hints_for_input(i, publicBag.all_hints_for_input(i));
	}

	const input = proverAlice.sign_tx_input_multi(
		index,
		fakeContext(),
		UnsignedTransaction.from_json(JSON.stringify(unsignedTx)),
		ErgoBoxes.from_boxes_json(unsignedTx.inputs),
		ErgoBoxes.empty(),
		combinedHints,
	);
	return input;
}

export async function signTxMultiStep3(
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

export async function signInputMultiStep3(
	unsignedTx: EIP12UnsignedTransaction,
	privateCommitsPool: JSONTransactionHintsBag,
	hints: JSONTransactionHintsBag,
	index: number,
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
	// let signedTx = proverBob.sign_reduced_transaction_multi(
	// 	reducedFromUnsignedTx(unsignedTx),
	// 	convertedHintsForBobSign
	// );
	const input = proverBob.sign_tx_input_multi(
		index,
		fakeContext(),
		UnsignedTransaction.from_json(JSON.stringify(unsignedTx)),
		ErgoBoxes.from_boxes_json(unsignedTx.inputs),
		ErgoBoxes.empty(),
		convertedHintsForBobSign,
	);

	return input;
}

function reducedFromUnsignedTx(unsignedTx: EIP12UnsignedTransaction) {
	const inputBoxes = ErgoBoxes.from_boxes_json(unsignedTx.inputs);
	const wasmUnsignedTx = UnsignedTransaction.from_json(JSON.stringify(unsignedTx));
	let context = fakeContext();
	let reducedTx = ReducedTransaction.from_unsigned_tx(
		wasmUnsignedTx,
		inputBoxes,
		ErgoBoxes.empty(),
		context,
	);
	return reducedTx;
}

export function verifyInput(
	signedTx: SignedTransaction,
	unsignedTx: EIP12UnsignedTransaction,
	index: number,
): Boolean {
	let context = fakeContext();
	let tx = Transaction.from_json(JSON.stringify(signedTx));
	const inputBoxes = ErgoBoxes.from_boxes_json(unsignedTx.inputs);
	const dataBoxes = ErgoBoxes.empty();

	let verified = verify_tx_input_proof(index, context, tx, inputBoxes, dataBoxes);
	return verified;
}

export function validateTx(signedTx: SignedTransaction, unsignedTx: EIP12UnsignedTransaction) {
	let context = fakeContext();
	let tx = Transaction.from_json(JSON.stringify(signedTx));
	const inputBoxes = ErgoBoxes.from_boxes_json(unsignedTx.inputs);
	const dataBoxes = ErgoBoxes.empty();
	validate_tx(tx, context, inputBoxes, dataBoxes);
}

export async function signTxMulti(
	unsignedTx: EIP12UnsignedTransaction,
	userMnemonic: string,
	userAddress: string,
): Promise<SignedTransaction> {
	const { privateCommitsPool, publicCommitsPool } = await signTxMultiStep1(unsignedTx);

	const extractedHints = await signTxMultiStep2(
		unsignedTx,
		userMnemonic,
		userAddress,
		publicCommitsPool,
	);

	const signedTx = await signTxMultiStep3(unsignedTx, privateCommitsPool, extractedHints);

	return signedTx.to_js_eip12();
}

export async function signTxInput(
	tx: EIP12UnsignedTransaction,
	mnemonic: string,
	index: number,
): Promise<Input> {
	const prover = await getProver(mnemonic);

	const boxesToSign = tx.inputs;
	const boxes_to_spend = ErgoBoxes.empty();
	boxesToSign.forEach(box => {
		boxes_to_spend.add(ErgoBox.from_json(JSON.stringify(box)));
	});

	const signedInput = prover.sign_tx_input(
		index,
		fakeContext(),
		UnsignedTransaction.from_json(JSON.stringify(tx)),
		boxes_to_spend,
		ErgoBoxes.empty(),
	);
	return signedInput;
}

export function arrayToProposition(input: Array<string>): Propositions {
	const output = new Propositions();
	input.forEach(pk => {
		const proposition = Uint8Array.from(Buffer.from('cd' + pk, 'hex'));
		output.add_proposition_from_byte(proposition);
	});
	return output;
}

export async function getProver(mnemonic: string): Promise<Wallet> {
	const secretKeys = new SecretKeys();
	secretKeys.add(getWalletAddressSecret(mnemonic));
	return Wallet.from_secrets(secretKeys);
}

const getWalletAddressSecret = (mnemonic: string, idx: number = 0) => {
	let seed = mnemonicToSeedSync(mnemonic);
	const path = calcPathFromIndex(idx);
	let bip32 = BIP32Factory(ecc);
	const extended = bip32.fromSeed(seed).derivePath(path);
	return SecretKey.dlog_from_bytes(Uint8Array.from(extended.privateKey ?? Buffer.from('')));
};

export async function signTx(
	tx: EIP12UnsignedTransaction,
	mnemonic: string,
): Promise<SignedTransaction> {
	const prover = await getProver(mnemonic);

	const boxesToSign = tx.inputs;
	const boxes_to_spend = ErgoBoxes.empty();
	boxesToSign.forEach(box => {
		boxes_to_spend.add(ErgoBox.from_json(JSON.stringify(box)));
	});

	const signedTx = prover.sign_transaction(
		fakeContext(),
		UnsignedTransaction.from_json(JSON.stringify(tx)),
		boxes_to_spend,
		ErgoBoxes.empty(),
	);
	return signedTx.to_js_eip12();
}

export function getProof(input: Input): Uint8Array {
	return input.spending_proof().proof();
}

export function compileContract(contract: string, map: any) {
	const tree = compile(contract, {
		version: 0,
		includeSize: false,
		map,
	});
	return tree.toAddress(Network.Mainnet).toString();
}

const RootPathWithoutIndex = "m/44'/429'/0'/0";
const calcPathFromIndex = (index: number) => `${RootPathWithoutIndex}/${index}`;
