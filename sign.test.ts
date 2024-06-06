import { ALICE_ADDRESS, ALICE_MNEMONIC, POOL_MNEMONIC, unsignedTx } from './constants';
import { signTxInput, signTxMulti } from './sign';
import { describe, it, expect } from 'vitest';
import * as a from 'sigmastate-js';
//import * as a from './node_modules/sigmastate-js/dist/main';

describe('signTxMulti', () => {
	it('should sign a the first input', async () => {
		const signedBobInput = await signTxInput(POOL_MNEMONIC, unsignedTx, 0);
		expect(signedBobInput).toBeDefined();
		expect(a).toBeDefined();
	});

	it.skip('should sign a the second input', async () => {
		const userMnemonic = ALICE_ADDRESS;
		const userAddress = ALICE_MNEMONIC;

		const signedTx = await signTxMulti(unsignedTx, userMnemonic, userAddress);
		expect(signedTx).toBeDefined();
	});
});
