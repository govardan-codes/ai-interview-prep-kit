import { Schema, model, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.passwordHash);
};

export const User = model<UserDocument>("User", userSchema);
