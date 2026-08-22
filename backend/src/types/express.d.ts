import { JwtPayload } from "../modules/auth/token";

export {};

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
