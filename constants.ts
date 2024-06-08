export const ALICE_MNEMONIC =
	'swim current hurry local faint obey scare vessel inch chest lock paddle since world agree';
export const POOL_MNEMONIC =
	'grit sorry wise village fork movie kingdom trend jar grant icon equal vessel case nominee';
export const BOB_MNEMONIC =
	'phrase belt winner top helmet satoshi unfold gas little until choose hurt rough minute name';

export const ALICE_ADDRESS = '9h4PvCt8B4ZJtzmpneRwatFwufMgTSLm8UXK2waxuHhgZjLZkgK';
export const BOB_ADDRESS = '9gQcQmLujhaWzyLxaRPKq1Fu5H9uAeikxiudRLiz9TmzBCixGo4';
export const POOL_ADDRESS = '9hh35g9W39kSKFuScYaLC7XqU8nunb3kmPXjwVkCyUsdx6ZdVnJ';

export const DEPOSIT_ADDRESS =
	't5UVmPtqprz5zN2M2X5fRTajpYD2CYuamxePkcwNFc2t9Yc3DhNMyB81fLAqoL7t91hzyYacMA8uVzkpTYTRdg4A6gZHFZxVsvLo'; // UserPK && PoolPK

export const utxo = [
	{
		boxId: '47ed36ed8e6dada89d0d51565cde03a5ad443609bb880874ebefbac27c0941ff',
		transactionId: 'ba1f7deee08cc3166e8e8dce748d42f04683af243067ba4227ef8f751cbe167e',
		blockId: '6210f8c1cb413af967f2f9c4c2a487d3bc9499a09e7e0f952cc9e50ededce367',
		value: '500000000',
		index: 0,
		globalIndex: 6197281,
		creationHeight: 1282260,
		settlementHeight: 1282262,
		ergoTree: '0008cd02f8bf1ab71f755192e39eb54fe4e7de5362ce618f9ac04550b96f87b0e674ed7c',
		ergoTreeConstants: '',
		ergoTreeScript: '{SigmaProp(ProveDlog(ECPoint(f8bf1a,5ba113,...)))}',
		address: '9gQcQmLujhaWzyLxaRPKq1Fu5H9uAeikxiudRLiz9TmzBCixGo4',
		assets: [],
		additionalRegisters: {},
		spentTransactionId: null,
		mainChain: true,
	},
	{
		boxId: '92a4dc2f8b25095978ac6a4c20de35d70fd49c3be93a2ba49c748865c04288c0',
		transactionId: 'a7f2978ab7b0fa283402f0f8576a661df76135193591f19cfd8d1e4339d9ba2a',
		blockId: '195b010e801c9143ba702031ec5e4be2f91a5da48cf0d747624060d28cc8398b',
		value: '1000000',
		index: 2,
		globalIndex: 6151231,
		creationHeight: 1280827,
		settlementHeight: 1280829,
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
		],
		additionalRegisters: {},
		spentTransactionId: null,
		mainChain: true,
	},
];
