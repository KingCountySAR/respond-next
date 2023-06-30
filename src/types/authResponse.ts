import { MyOrganization } from './organization'
import { UserInfo } from './userInfo'

export interface AuthResponse {
    userInfo: UserInfo | undefined
    organization: MyOrganization | undefined
    error: string | undefined
}