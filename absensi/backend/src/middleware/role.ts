import { Request, Response, NextFunction } from "express";

export const onlyRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!roles.includes((req as any).user.role)) {
    return res.status(403).json({ success: false, message: "Akses ditolak", data: null });
  }
  next();
};
