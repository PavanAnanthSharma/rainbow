import { BigNumber } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { JsonRpcProvider } from '@ethersproject/providers';
import { toLower } from 'lodash';
import { arbitrumEnabled } from '../config/debug';
// eslint-disable-next-line import/no-cycle
import { addressAssetsReceived, fetchAssetPrices } from './data';
// eslint-disable-next-line import/no-cycle
import { emitAssetRequest, emitChartsRequest } from './explorer';
import networkInfo from '@rainbow-me/helpers/networkInfo';
import networkTypes from '@rainbow-me/helpers/networkTypes';
import {
  balanceCheckerContractAbiOVM,
  testnetAssets,
} from '@rainbow-me/references';
import { ethereumUtils } from '@rainbow-me/utils';
import logger from 'logger';

// -- Constants --------------------------------------- //
export const ARBITRUM_MAINNET_RPC_ENDPOINT = 'https://arb1.arbitrum.io/rpc';
const ARBITRUM_EXPLORER_CLEAR_STATE = 'explorer/ARBITRUM_EXPLORER_CLEAR_STATE';
const ARBITRUM_EXPLORER_SET_ASSETS = 'explorer/ARBITRUM_EXPLORER_SET_ASSETS';
const ARBITRUM_EXPLORER_SET_BALANCE_HANDLER =
  'explorer/ARBITRUM_EXPLORER_SET_BALANCE_HANDLER';
const ARBITRUM_EXPLORER_SET_HANDLERS =
  'explorer/ARBITRUM_EXPLORER_SET_HANDLERS';
const ARBITRUM_EXPLORER_SET_LATEST_TX_BLOCK_NUMBER =
  'explorer/ARBITRUM_EXPLORER_SET_LATEST_TX_BLOCK_NUMBER';

const UPDATE_BALANCE_AND_PRICE_FREQUENCY = 30000;

const arbitrumProvider = new JsonRpcProvider(ARBITRUM_MAINNET_RPC_ENDPOINT);

const network = networkTypes.arbitrum;

const fetchAssetBalances = async (tokens, address) => {
  const abi = balanceCheckerContractAbiOVM;

  const contractAddress = networkInfo[network].balance_checker_contract_address;

  const balanceCheckerContract = new Contract(
    contractAddress,
    abi,
    arbitrumProvider
  );

  try {
    const values = await balanceCheckerContract.balances([address], tokens);
    const balances = {};
    [address].forEach((addr, addrIdx) => {
      balances[addr] = {};
      tokens.forEach((tokenAddr, tokenIdx) => {
        const balance = values[addrIdx * tokens.length + tokenIdx];
        balances[addr][tokenAddr] = balance.toString();
      });
    });
    return balances[address];
  } catch (e) {
    logger.log(
      'Error fetching balances from balanceCheckerContract',
      network,
      e
    );
    return null;
  }
};

export const arbitrumExplorerInit = () => async (dispatch, getState) => {
  if (!arbitrumEnabled) return;
  const { assets: allAssets, genericAssets } = getState().data;
  const { accountAddress, nativeCurrency } = getState().settings;
  const formattedNativeCurrency = toLower(nativeCurrency);

  const fetchAssetsBalancesAndPrices = async () => {
    logger.log('🔵 arbitrumExplorer fetchAssetsBalancesAndPrices');
    const assets = testnetAssets[network];
    if (!assets || !assets.length) {
      const arbitrumExplorerBalancesHandle = setTimeout(
        fetchAssetsBalancesAndPrices,
        10000
      );
      dispatch({
        payload: {
          arbitrumExplorerBalancesHandle,
        },
        type: ARBITRUM_EXPLORER_SET_BALANCE_HANDLER,
      });
      return;
    }

    const tokenAddresses = assets.map(
      ({ asset: { asset_code } }) => asset_code
    );

    dispatch(emitAssetRequest(tokenAddresses));
    dispatch(emitChartsRequest(tokenAddresses));

    const prices = await fetchAssetPrices(
      assets.map(({ asset: { coingecko_id } }) => coingecko_id),
      formattedNativeCurrency
    );

    if (prices) {
      Object.keys(prices).forEach(key => {
        for (let i = 0; i < assets.length; i++) {
          if (toLower(assets[i].asset.coingecko_id) === toLower(key)) {
            const asset =
              ethereumUtils.getAsset(
                allAssets,
                toLower(assets[i].asset.mainnet_address)
              ) || genericAssets[toLower(assets[i].asset.mainnet_address)];

            assets[i].asset.price = asset?.price || {
              changed_at: prices[key].last_updated_at,
              relative_change_24h:
                prices[key][`${formattedNativeCurrency}_24h_change`],
              value: prices[key][`${formattedNativeCurrency}`],
            };
            break;
          }
        }
      });
    }
    const balances = await fetchAssetBalances(
      assets.map(({ asset: { asset_code } }) => asset_code),
      accountAddress,
      network
    );

    let total = BigNumber.from(0);

    if (balances) {
      Object.keys(balances).forEach(key => {
        for (let i = 0; i < assets.length; i++) {
          if (assets[i].asset.asset_code.toLowerCase() === key.toLowerCase()) {
            assets[i].quantity = balances[key];
            break;
          }
        }
        total = total.add(balances[key]);
      });
    }

    logger.log('🔵 arbitrumExplorer updating assets');
    dispatch(
      addressAssetsReceived(
        {
          meta: {
            address: accountAddress,
            currency: nativeCurrency,
            status: 'ok',
          },
          payload: { assets },
        },
        true
      )
    );

    const arbitrumExplorerBalancesHandle = setTimeout(
      fetchAssetsBalancesAndPrices,
      UPDATE_BALANCE_AND_PRICE_FREQUENCY
    );
    let arbitrumExplorerAssetsHandle = null;

    dispatch({
      payload: {
        arbitrumExplorerAssetsHandle,
        arbitrumExplorerBalancesHandle,
      },
      type: ARBITRUM_EXPLORER_SET_HANDLERS,
    });
  };
  fetchAssetsBalancesAndPrices();
};

export const arbitrumExplorerClearState = () => (dispatch, getState) => {
  const {
    arbitrumExplorerBalancesHandle,
    arbitrumExplorerAssetsHandle,
  } = getState().arbitrumExplorer;

  arbitrumExplorerBalancesHandle &&
    clearTimeout(arbitrumExplorerBalancesHandle);
  arbitrumExplorerAssetsHandle && clearTimeout(arbitrumExplorerAssetsHandle);
  dispatch({ type: ARBITRUM_EXPLORER_CLEAR_STATE });
};

// -- Reducer ----------------------------------------- //
const INITIAL_STATE = {
  arbitrumExplorerAssetsHandle: null,
  arbitrumExplorerBalancesHandle: null,
  assetsFound: [],
};

export default (state = INITIAL_STATE, action) => {
  switch (action.type) {
    case ARBITRUM_EXPLORER_SET_ASSETS:
      return {
        ...state,
        assetsFound: action.payload.assetsFound,
      };
    case ARBITRUM_EXPLORER_CLEAR_STATE:
      return {
        ...state,
        ...INITIAL_STATE,
      };
    case ARBITRUM_EXPLORER_SET_LATEST_TX_BLOCK_NUMBER:
      return {
        ...state,
        latestTxBlockNumber: action.payload.latestTxBlockNumber,
      };
    case ARBITRUM_EXPLORER_SET_HANDLERS:
      return {
        ...state,
        arbitrumExplorerAssetsHandle:
          action.payload.arbitrumExplorerAssetsHandle,
        arbitrumExplorerBalancesHandle:
          action.payload.arbitrumExplorerBalancesHandle,
      };
    case ARBITRUM_EXPLORER_SET_BALANCE_HANDLER:
      return {
        ...state,
        arbitrumExplorerBalancesHandle:
          action.payload.arbitrumExplorerBalancesHandle,
      };
    default:
      return state;
  }
};