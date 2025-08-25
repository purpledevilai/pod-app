// src/stores/root-store.ts
import { makeAutoObservable, runInAction } from 'mobx';
import { AuthStore } from './auth.store';

export class RootStore {
  auth: AuthStore;
  bootstrapped = false;

  constructor() {
    this.auth = new AuthStore();
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async bootstrap() {
    if (this.bootstrapped) return;
    try {
      // Add other store bootstraps here as you grow
      await Promise.all([
        this.auth.bootstrap(),
        // this.profile.bootstrap(),
        // this.settings.bootstrap(),
      ]);
    } finally {
      runInAction(() => { this.bootstrapped = true; });
    }
  }
}

export const rootStore = new RootStore();
