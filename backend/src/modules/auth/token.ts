import jwt from "jsonwebtoken";
import { config } from "../../config";

export interface JwtPayload {
    id: number;
    username: string;
}

export function signToken(payload: JwtPayload) {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: "7d"});
}

export function verifyToken(token: string) {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
}