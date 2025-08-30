// src/stores/root-store.ts
import { makeAutoObservable, runInAction } from 'mobx';
import { AuthStore } from './auth.store';

export class RootStore {
  authStore: AuthStore;
  bootstrapped = false;

  constructor() {
    this.authStore = new AuthStore();
    makeAutoObservable(this, {}, { autoBind: true });
  }

  async bootstrap() {
    if (this.bootstrapped) return;
    try {
      await Promise.all([
        this.authStore.bootstrap(),
      ]);
    } finally {
      runInAction(() => { this.bootstrapped = true; });
    }
  }
}

export const rootStore = new RootStore();
