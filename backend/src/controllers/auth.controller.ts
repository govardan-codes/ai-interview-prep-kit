import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

function signToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

export async function register(req: Request, res: Response) {
  const { email, password } = req.body ?? {};
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: { code: "INVALID_INPUT", message: "Email and an 8+ character password are required" } });
  }
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: { code: "EMAIL_TAKEN", message: "An account with that email already exists" } });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email, passwordHash });
  const token = signToken(String(user._id));
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  res.status(201).json({ token, user: { id: user._id, email: user.email } });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body ?? {};
  const user = await User.findOne({ email: (email ?? "").toLowerCase() });
  if (!user || !(await user.comparePassword(password ?? ""))) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Incorrect email or password" } });
  }
  const token = signToken(String(user._id));
  res.cookie("token", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  res.json({ token, user: { id: user._id, email: user.email } });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie("token");
  res.json({ ok: true });
}
