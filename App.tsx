import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import {Buffer} from 'buffer';
global.Buffer = global.Buffer || Buffer;
import {StatusBar} from 'expo-status-bar';
import React, {useState, useEffect} from 'react';

import {Picker} from '@react-native-picker/picker';

import PayWithIvoryPayBase from './src/components/PayWithIvoryPayBase';
import {baseFiat, cryptoCurrencies} from './src/constants';
import {ITransactionResponse} from './src/types';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import {PublicKey} from '@solana/web3.js';

//IMPORTS FOR PHANTOM CONNECT
import * as Linking from 'expo-linking';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import {decryptPayload} from './utils/decryptPayload';
import {encryptPayload} from './utils/encryptPayload';

const onConnectRedirectLink = Linking.createURL('onConnect');
const onDisconnectRedirectLink = Linking.createURL('onDisconnect');
export const BASE_URL = 'https://phantom.app/ul/v1/';
export const buildUrl = (path: string, params: URLSearchParams) =>
  `${BASE_URL}${path}?${params.toString()}`;

export default function App() {
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] =
    useState<PublicKey | null>(null);

  const [dappKeyPair] = useState(nacl.box.keyPair());
  const [sharedSecret, setSharedSecret] = useState<Uint8Array>();
  const [session, setSession] = useState<string>();
  const [deepLink, setDeepLink] = useState<string>('');

  const [form, setForm] = useState({
    crypto: cryptoCurrencies[0],
    baseFiat: baseFiat[0],
    amount: '2000',
    reference: '',
    email: '',
    PUBLIC_KEY:
      'pk_LeVNjEiwkQok4vwgLCOoIl5CSi2N1svXn5Y9YX7Af3urymCRmKvClK3exWvwTJgb',
  });

  const setField = (key: string) => {
    return (e: string | number) => setForm(prev => ({...prev, [key]: e}));
  };

  const onClose = () => {
    console.log('closed');
  };

  const onSuccess = (e: ITransactionResponse) => {
    Alert.alert('Payment was successful');
  };

  const onFailure = (e: ITransactionResponse) => {
    Alert.alert('Payment was unsuccessful');
  };

  // On app start up, check if we were opened by an inbound deeplink. If so, track the intial URL
  // Then, listen for a "url" event
  useEffect(() => {
    const initializeDeeplinks = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        setDeepLink(initialUrl);
      }
    };
    initializeDeeplinks();
    const listener = Linking.addEventListener('url', handleDeepLink);
    return () => {
      listener.remove();
    };
  }, []);

  // When a "url" event occurs, track the url
  const handleDeepLink = ({url}: Linking.EventType) => {
    setDeepLink(url);
  };

  // Handle in-bound links
  useEffect(() => {
    if (!deepLink) return;

    const url = new URL(deepLink);
    const params = url.searchParams;

    // Handle an error response from Phantom
    if (params.get('errorCode')) {
      const error = Object.fromEntries([...params]);
      const message =
        error?.errorMessage ??
        JSON.stringify(Object.fromEntries([...params]), null, 2);
      console.log('error: ', message);
      return;
    }

    // Handle a `connect` response from Phantom
    if (/onConnect/.test(url.pathname)) {
      const sharedSecretDapp = nacl.box.before(
        bs58.decode(params.get('phantom_encryption_public_key')!),
        dappKeyPair.secretKey,
      );
      const connectData = decryptPayload(
        params.get('data')!,
        params.get('nonce')!,
        sharedSecretDapp,
      );
      setSharedSecret(sharedSecretDapp);
      setSession(connectData.session);
      setPhantomWalletPublicKey(new PublicKey(connectData.public_key));
      console.log(`connected to ${connectData.public_key.toString()}`);
    }

    // Handle a `disconnect` response from Phantom
    if (/onDisconnect/.test(url.pathname)) {
      setPhantomWalletPublicKey(null);
      console.log('disconnected');
    }
  }, [deepLink]);

  // Initiate a new connection to Phantom
  const connect = async () => {
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      cluster: 'devnet',
      app_url: 'https://phantom.app',
      redirect_link: onConnectRedirectLink,
    });

    const url = `https://phantom.app/ul/v1/connect?${params.toString()}`;
    Linking.openURL(url);
  };

  // Initiate a disconnect from Phantom
  const disconnect = async () => {
    const payload = {
      session,
    };
    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      nonce: bs58.encode(nonce),
      redirect_link: onDisconnectRedirectLink,
      payload: bs58.encode(encryptedPayload),
    });
    const url = buildUrl('disconnect', params);
    Linking.openURL(url);
  };

  return (
    <ScrollView>
      <View style={{padding: 16}}>
        <TextInput
          keyboardType="email-address"
          placeholder="email"
          onChangeText={setField('email')}
          autoFocus
          value={form.email}
          style={{
            borderWidth: 1,
            padding: 12,
            marginTop: 16,
          }}
        />
        <View
          style={{
            borderWidth: 1,
            marginTop: 16,
            borderColor: 'black',
          }}>
          <Picker
            placeholder="base fiat"
            selectedValue={form.baseFiat}
            onValueChange={setField('baseFiat')}>
            {baseFiat.map(e => (
              <Picker.Item key={e} label={e} value={e} />
            ))}
          </Picker>
        </View>
        <TextInput
          keyboardType="phone-pad"
          placeholder="amount"
          value={form.amount}
          onChangeText={setField('amount')}
          style={{
            borderWidth: 1,
            padding: 12,
            marginTop: 16,
          }}
        />
        <View
          style={{
            borderWidth: 1,
            marginTop: 16,
            borderColor: 'black',
          }}>
          <Picker
            placeholder="crypto"
            selectedValue={form.crypto}
            onValueChange={setField('crypto')}>
            {cryptoCurrencies.map(e => (
              <Picker.Item key={e} label={e} value={e} />
            ))}
          </Picker>
        </View>
        <TextInput
          placeholder="api-key"
          onChangeText={setField('PUBLIC_KEY')}
          value={form.PUBLIC_KEY}
          style={{
            borderWidth: 1,
            padding: 12,
            marginTop: 16,
          }}
        />
        <TextInput
          placeholder="reference (optional)"
          onChangeText={setField('reference')}
          selectTextOnFocus
          value={form.reference}
          style={{
            borderWidth: 1,
            padding: 12,
            marginVertical: 16,
          }}
        />
        <PayWithIvoryPayBase
          // customButton={({initTransaction, isLoading}) => (
          //   <Button
          //     title={'Make payment'}
          //     disabled={isLoading}
          //     onPress={() => {
          //       console.log('started');
          //       initTransaction();
          //     }}
          //   />
          // )}
          onError={e => Alert.alert(e.message)}
          options={form}
          onClose={onClose}
          onSuccess={onSuccess}
          onFailure={onFailure}
          disabled={false}
          allowPhantomConnect={true}
          connect={connect}
        />
      </View>
    </ScrollView>
  );
}
