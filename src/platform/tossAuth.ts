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

export type TossConnectionStatusCheck = (coreUserId: string) => Promise<boolean>;
export type TossLoginFn = () => Promise<TossLoginResult>;

export type TossLoginExchange = (input: TossLoginExchangeInput) => Promise<TossLoginExchangeResult>;
export type TossSignOutLocal = () => void | Promise<void>;

export interface AppsInTossAuthAdapter {
  signInWithToss(): Promise<TossLoginExchangeResult>;
  signOutLocal(): Promise<void>;
  verifyLocalConnection(coreUserId: string): Promise<boolean>;
}

export const createAppsInTossAuthAdapter = (deps: {
  appLogin?: TossLoginFn;
  exchangeTossLogin: TossLoginExchange;
  verifyConnection?: TossConnectionStatusCheck;
  signOutLocal?: TossSignOutLocal;
}): AppsInTossAuthAdapter => {
  const appLogin = deps.appLogin ?? appsInTossLogin;
  return {
    async signInWithToss() {
      const { authorizationCode, referrer } = await appLogin();
      return deps.exchangeTossLogin({ authorizationCode, referrer });
    },
    async signOutLocal() {
      await deps.signOutLocal?.();
    },
    async verifyLocalConnection(coreUserId: string) {
      return deps.verifyConnection ? deps.verifyConnection(coreUserId) : false;
    },
  };
};
