import { appLogin as appsInTossLogin } from '@apps-in-toss/web-framework';

export type TossLoginResult = {
  authorizationCode: string;
  referrer: 'DEFAULT' | 'SANDBOX';
};

export type TossLoginExchangeInput = TossLoginResult;

export type TossLoginExchangeResult = {
  linked: boolean;
  coreUserId?: string;
};

export type TossLoginFn = () => Promise<TossLoginResult>;

export type TossLoginExchange = (input: TossLoginExchangeInput) => Promise<TossLoginExchangeResult>;

export interface AppsInTossAuthAdapter {
  signInWithToss(): Promise<TossLoginExchangeResult>;
}

export const createAppsInTossAuthAdapter = (deps: {
  appLogin?: TossLoginFn;
  exchangeTossLogin: TossLoginExchange;
}): AppsInTossAuthAdapter => {
  const appLogin = deps.appLogin ?? appsInTossLogin;
  return {
    async signInWithToss() {
      const { authorizationCode, referrer } = await appLogin();
      return deps.exchangeTossLogin({ authorizationCode, referrer });
    },
  };
};
