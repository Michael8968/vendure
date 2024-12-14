import * as Codegen from '../../common/generated-types';
import { ATTEMPT_LOGIN, GET_CURRENT_USER, LOG_OUT } from '../definitions/auth-definitions';

import { BaseDataService } from './base-data.service';

export class AuthDataService {
    private username: string | null = null;
    private password: string | null = null;
    constructor(private baseDataService: BaseDataService) {}

    currentUser() {
        return this.baseDataService.query<Codegen.GetCurrentUserQuery>(GET_CURRENT_USER);
    }

    attemptLogin(username: string, password: string, rememberMe: boolean) {
        this.username = username;
        this.password = password;
        return this.baseDataService.mutate<
            Codegen.AttemptLoginMutation,
            Codegen.AttemptLoginMutationVariables
        >(ATTEMPT_LOGIN, {
            username,
            password,
            rememberMe,
        });
    }

    logOut() {
        return this.baseDataService.mutate<Codegen.LogOutMutation>(LOG_OUT);
    }

    getLoginCredentials() {
        return {
            username: this.username,
            password: this.password,
        };
    }
}
