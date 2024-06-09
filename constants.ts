export const ALICE_MNEMONIC =
	'swim current hurry local faint obey scare vessel inch chest lock paddle since world agree1';
export const BOB_MNEMONIC =
	'grit sorry wise village fork movie kingdom trend jar grant icon equal vessel case nominee';
export const POOL_MNEMONIC =
	'phrase belt winner top helmet satoshi unfold gas little until choose hurt rough minute name';

export const ALICE_ADDRESS = '9h4PvCt8B4ZJtzmpneRwatFwufMgTSLm8UXK2waxuHhgZjLZkgK';
export const BOB_ADDRESS = '9hh35g9W39kSKFuScYaLC7XqU8nunb3kmPXjwVkCyUsdx6ZdVnJ';
export const POOL_ADDRESS = '9gQcQmLujhaWzyLxaRPKq1Fu5H9uAeikxiudRLiz9TmzBCixGo4';

export const utxo = [
	{
		boxId: 'fe4daef7e5eaa2bb93013d94c1ae78c272d9ac11e9b1d4e1f515405ef2668de8',
		transactionId: '2194af861e036f3a7012a6efda33686b32a7fffe188ae408a291cdb0fd7dcb4e',
		blockId: 'a7b3deaae00a8edf11637ffd5a74e328c731b842bb0e080da27b905c0baacde7',
		value: '5000000000',
		index: 0,
		globalIndex: 6150710,
		creationHeight: 1280810,
		settlementHeight: 1280812,
		ergoTree: '0008cd02f8bf1ab71f755192e39eb54fe4e7de5362ce618f9ac04550b96f87b0e674ed7c',
		ergoTreeConstants: '',
		ergoTreeScript: '{SigmaProp(ProveDlog(ECPoint(f8bf1a,5ba113,...)))}',
		address: '9gQcQmLujhaWzyLxaRPKq1Fu5H9uAeikxiudRLiz9TmzBCixGo4',
		assets: [
			{
				tokenId: '5bf691fbf0c4b17f8f8cece83fa947f62f480bfbd242bd58946f85535125db4d',
				index: 0,
				amount: '100000000000000',
				name: 'rsBTC',
				decimals: 8,
				type: 'EIP-004',
			},
			{
				tokenId: 'f60bff91f7ae3f3a5f0c2d35b46ef8991f213a61d7f7e453d344fa52a42d9f9a',
				index: 1,
				amount: '500000000',
				name: 'SigUSD',
				decimals: 2,
				type: 'EIP-004',
			},
		],
		additionalRegisters: {},
		spentTransactionId: null,
		mainChain: true,
	},
];

//https://api.ergoplatform.com/api/v1/info
const info = {
	lastBlockId: '5b9b19ac028c6956b4cdf8ec75227934b8134ff3635ed3aceac8a8bf20788dce',
	height: 1282261,
	maxBoxGix: 6197269,
	maxTxGix: 1167892,
	params: {
		height: 506880,
		storageFeeFactor: 1250000,
		minValuePerByte: 360,
		maxBlockSize: 1271009,
		maxBlockCost: 7030268,
		blockVersion: 2,
		tokenAccessCost: 100,
		inputCost: 2000,
		dataInputCost: 100,
		outputCost: 100,
	},
};

export const BLOCKCHAIN_PARAMETERS = {
	storageFeeFactor: info.params.storageFeeFactor,
	minValuePerByte: info.params.minValuePerByte,
	maxBlockSize: info.params.maxBlockSize,
	tokenAccessCost: info.params.tokenAccessCost,
	inputCost: info.params.inputCost,
	dataInputCost: info.params.dataInputCost,
	outputCost: info.params.outputCost,
	maxBlockCost: info.params.maxBlockCost,
	softForkStartingHeight: 100,
	softForkVotesCollected: 50,
	blockVersion: info.params.blockVersion,
};
