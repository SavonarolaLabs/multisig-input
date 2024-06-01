import { ALICE_ADDRESS, ALICE_MNEMONIC, POOL_MNEMONIC, unsignedTx } from './constants';
import { signTxInput, signTxMulti } from './sign';
import { describe, it, expect } from 'vitest';

// unsignedTx has 2 inputs:
// input[0] is protected by poolPK
// input[1] is protected by alicePK && poolPk
describe('signTxMulti', () => {
	it('should sign a the first input', async () => {
		const signedBobInput = await signTxInput(POOL_MNEMONIC, unsignedTx, 0);
		expect(signedBobInput).toBeDefined();
	});

	it('should sign a the second input', async () => {
		const userMnemonic = ALICE_ADDRESS;
		const userAddress = ALICE_MNEMONIC;

		const signedTx = await signTxMulti(unsignedTx, userMnemonic, userAddress);
		expect(signedTx).toBeDefined();
	});
});
