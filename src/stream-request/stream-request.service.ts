import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { StreamRequest } from "./stream-request.schema";
import { Model } from "mongoose";
import { randomBytes, bytesToHex } from "@noble/hashes/utils";
import { Interval } from "@nestjs/schedule";
import { STREAM_REQUEST_EXPIRE_TIME } from "../constants";

@Injectable()
export class StreamRequestService {
  constructor(
    @InjectModel(StreamRequest.name)
    private streamRequestModel: Model<StreamRequest>,
  ) {}

  private expireCutoffDate() {
    return new Date(Date.now() - STREAM_REQUEST_EXPIRE_TIME);
  }

  async makeRequest(webId: string) {
    const entry = new this.streamRequestModel({
      webId,
      challenge: bytesToHex(randomBytes(32)),
      createdAt: new Date(),
    });
    await entry.save({ validateBeforeSave: true });

    return entry.challenge;
  }

  async verifyRequest(webId: string, challenge: string): Promise<boolean> {
    const result = await this.streamRequestModel.findOneAndDelete({
      webId,
      challenge,
      createdAt: { $gt: this.expireCutoffDate() },
    });

    return !!result;
  }

  // Routinely clean up expired requests
  @Interval(STREAM_REQUEST_EXPIRE_TIME)
  async cleanupExpiredRequests() {
    console.log("Cleaning up expired stream requests");
    await this.streamRequestModel.deleteMany({
      createdAt: { $lt: this.expireCutoffDate() },
    });
  }
}
