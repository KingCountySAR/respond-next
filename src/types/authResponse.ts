import { MyOrganization } from './organization'
import { UserInfo } from './userInfo'

export interface AuthResponse {
    userInfo?: UserInfo
    organization?: MyOrganization
    error?: string
}