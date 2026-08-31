import { JwtPayload } from "../modules/auth/token";

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}
