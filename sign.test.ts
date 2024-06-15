import {
	ALICE_ADDRESS,
	ALICE_MNEMONIC,
	BLOCKCHAIN_PARAMETERS,
	BOB_ADDRESS,
	BOB_MNEMONIC,
	POOL_ADDRESS,
	POOL_MNEMONIC,
	utxo,
} from './constants';
import {
	a,
	arrayToProposition,
	bInput,
	cInput,
	signTx,
	signTxInput,
	signTxMulti,
	validateTx,
	verifyInput,
} from './sign';
import { describe, it, expect, beforeAll } from 'vitest';
import { AvlTree$, ProverBuilder$, ReducedInputData, ReducedTransaction } from 'sigmastate-js/main';
import bip39 from 'bip39';
import { fakeContext, headers, jsonHeaders, sigmaJsHeader } from 'fakeContext';
import {
	ErgoAddress,
	OutputBuilder,
	SAFE_MIN_BOX_VALUE,
	SGroupElement,
	SSigmaProp,
	TransactionBuilder,
} from '@fleet-sdk/core';
import { EIP12UnsignedTransaction, first, Network } from '@fleet-sdk/common';
import { compile } from '@fleet-sdk/compiler';
import {
	ErgoBoxes,
	extract_hints,
	Input,
	Transaction,
	UnsignedTransaction,
	verify_tx_input_proof,
} from 'ergo-lib-wasm-nodejs';
type SignedTransaction =
	import('./node_modules/sigmastate-js/node_modules/@fleet-sdk/common/dist/esm/types/transactions').SignedTransaction;

const network = 0;
const height = 1209955;

describe('UnsignedTransaction', () => {
	let unsignedTx: EIP12UnsignedTransaction;

	beforeAll(() => {
		const output = new OutputBuilder(
			2n * SAFE_MIN_BOX_VALUE + SAFE_MIN_BOX_VALUE,
			ALICE_ADDRESS,
		);

		unsignedTx = new TransactionBuilder(height)
			.from(utxo)
			.to(output)
			.sendChangeTo(POOL_ADDRESS)
			.payFee(SAFE_MIN_BOX_VALUE)
			.build()
			.toEIP12Object();
	});

	it('ergo-lib-wasm-nodejs can sign', async () => {
		const signedBobInput = await signTxInput(unsignedTx, POOL_MNEMONIC, 0);
		expect(signedBobInput).toBeDefined();
	});

	it('sigmastate.js can reduceTransactionInput', async () => {
		const buffer = await bip39.mnemonicToSeed(POOL_MNEMONIC);
		const mnemonicPhrase = buffer.toString('hex');

		const prover = ProverBuilder$.create(BLOCKCHAIN_PARAMETERS, network)
			.withMnemonic(mnemonicPhrase, '')
			.build();

		const xHeaders = jsonHeaders.map(sigmaJsHeader);

		const stateCtx = {
			sigmaLastHeaders: xHeaders.slice(1),
			previousStateDigest: xHeaders[1].stateRoot.digest,
			sigmaPreHeader: xHeaders[0],
		};

		const reducedInput: ReducedInputData = prover.reduceTransactionInput(
			stateCtx,
			unsignedTx,
			unsignedTx.inputs,
			unsignedTx.dataInputs,
			[],
			0,
		);
		expect(reducedInput).toBeDefined();

		const reducedTx: ReducedTransaction = prover.reduce(
			stateCtx,
			unsignedTx,
			unsignedTx.inputs,
			unsignedTx.dataInputs,
			[],
			0,
		);
		expect(reducedTx).toBeDefined();

		const hints = prover.generateCommitments(reducedTx);
		expect(hints).toBeDefined();
		//console.dir(hints, {depth:null})

		//const signedTx: SignedTransaction = prover.signReduced(reducedTx, hints);
		//expect(signedTx).toBeDefined();
	});
});

describe('ergo-lib-wasm-nodejs', () => {
	let withdrawUTx: EIP12UnsignedTransaction;

	beforeAll(async () => {
		const CONTRACT_MULTISIG = `{
			UserPk && PoolPk
		}`;
		const contract_multisig = compileContract(CONTRACT_MULTISIG);

		const output = new OutputBuilder(
			2n * SAFE_MIN_BOX_VALUE + SAFE_MIN_BOX_VALUE,
			contract_multisig,
		);

		const unsignedTx = new TransactionBuilder(height)
			.from(utxo)
			.to(output)
			.sendChangeTo(POOL_ADDRESS)
			.payFee(SAFE_MIN_BOX_VALUE)
			.build()
			.toEIP12Object();

		const signedTx = await signTx(unsignedTx, POOL_MNEMONIC);
		expect(signedTx).toBeDefined();

		const depositBox = signedTx.outputs[0];

		withdrawUTx = new TransactionBuilder(height)
			.from(depositBox)
			.sendChangeTo(POOL_ADDRESS)
			.payFee(SAFE_MIN_BOX_VALUE)
			.build()
			.toEIP12Object();
	});

	it('can sign simple multisig', async () => {
		const withdrawTx = await signTxMulti(withdrawUTx, BOB_MNEMONIC, BOB_ADDRESS);

		expect(withdrawTx).toBeDefined();

		const verifyInput0 = verifyInput(withdrawTx, withdrawUTx, 0);
		expect(verifyInput0).toBe(true);

		// const valid0 = verify_tx_input_proof(
		// 	0,
		// 	fakeContext(),
		// 	Transaction.from_json(JSON.stringify(withdrawTx)),
		// 	ErgoBoxes.from_boxes_json(withdrawUTx.inputs),
		// 	ErgoBoxes.empty(),
		// );
		// expect(valid0).toBe(true);

		expect(
			() => validateTx(withdrawTx, withdrawUTx),
			'withdraw tx validation',
		).not.toThrowError();
	});

	it.only('can sign simple multisig by SignInput  ', async () => {
		// multisig signing a single input[1]
		const { privateCommitsPool, publicCommitsPool } = await a(withdrawUTx);
		expect(publicCommitsPool).toBeDefined();

		const sInput0: Input = await bInput(
			withdrawUTx,
			BOB_MNEMONIC,
			BOB_ADDRESS,
			publicCommitsPool,
			0,
		);

		function hexToUint8Array(str: string): Uint8Array {
			const utf8: string = unescape(encodeURIComponent(str));
			const array = new Uint8Array(utf8.length);
			for (let i = 0; i < utf8.length; i++) {
				array[i] = utf8.charCodeAt(i);
			}
			return array;
		}

		function getProof(input: Input) {
			return hexToUint8Array(input.spending_proof().to_json());
		}

		// const transaction = proverAlice.sign_reduced_transaction_multi(reducedTx, combinedHints);
		const unsigned_tx = UnsignedTransaction.from_json(JSON.stringify(withdrawUTx));
		const tx = Transaction.from_unsigned_tx(unsigned_tx, [getProof(sInput0)]);

		const hUser = ErgoAddress.fromBase58(BOB_ADDRESS).ergoTree.slice(6);

		let extractedHints = extract_hints(
			tx,
			fakeContext(),
			ErgoBoxes.from_boxes_json(withdrawUTx.inputs),
			ErgoBoxes.empty(),
			arrayToProposition([hUser]),
			arrayToProposition([]),
		).to_json();

		const signedInput = await cInput(withdrawUTx, privateCommitsPool, extractedHints, 0);
		const utx = UnsignedTransaction.from_json(JSON.stringify(withdrawUTx));
		const signedTx = Transaction.from_unsigned_tx(utx, [getProof(signedInput)]);

		//add id
		const signedWithId = signedTx.to_js_eip12();
		signedWithId.id = signedTx.id().to_str();

		// const verifyInput0 = verifyInput(signedWithId, withdrawUTx, 0);
		// expect(verifyInput0).toBe(true);

		// const valid0 = verify_tx_input_proof(
		// 	0,
		// 	fakeContext(),
		// 	signedTx,
		// 	ErgoBoxes.from_boxes_json(withdrawUTx.inputs),
		// 	ErgoBoxes.empty(),
		// );
		// expect(valid0).toBe(true);

		expect(
			() => validateTx(signedWithId, withdrawUTx),
			'withdraw tx validation',
		).not.toThrowError();
	});
});

export function compileContract(contract: string) {
	const tree = compile(contract, {
		version: 0,
		includeSize: false,
		map: {
			PoolPk: SSigmaProp(
				SGroupElement(first(ErgoAddress.fromBase58(POOL_ADDRESS).getPublicKeys())),
			).toHex(),
			UserPk: SSigmaProp(
				SGroupElement(first(ErgoAddress.fromBase58(BOB_ADDRESS).getPublicKeys())),
			).toHex(),
		},
	});
	return tree.toAddress(Network.Mainnet).toString();
}
