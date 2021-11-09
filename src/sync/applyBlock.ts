import { Context } from "@openland/context";
import BN from "bn.js";
import { getStorage } from "../storage/Storage";
import { TonBlock } from "../types";

export async function applyBlocks(ctx: Context, blocks: TonBlock[]) {

    const storage = getStorage(ctx);

    let addressState = new Map<string, {
        min: { lt: BN, hash: string, seq: number },
        max: { lt: BN, hash: string, seq: number }
    }>();

    // Fetch account transaction min/max
    for (let b of blocks) {
        for (let shard of b.shards) {
            for (let tx of shard.transactions) {
                let address = tx.address.toFriendly();
                let lt = new BN(tx.lt);
                let hash = tx.hash;
                // Update address
                if (!addressState.has(address)) {
                    addressState.set(address, {
                        min: { lt, hash, seq: b.seqno },
                        max: { lt, hash, seq: b.seqno }
                    });
                } else {
                    let ex = addressState.get(address)!;
                    if (ex.min.lt.gt(lt)) {
                        ex.min.lt = lt;
                        ex.min.hash = hash;
                        ex.min.seq = b.seqno;
                    }
                    if (ex.max.lt.lt(lt)) {
                        ex.max.lt = lt;
                        ex.max.hash = hash;
                        ex.max.seq = b.seqno;
                    }
                }
            }
        }
    }

    // Apply accounts
    for (let acc of addressState) {

        // Fetch
        let existing = await storage.accounts.get(ctx, [acc[0]]) as {
            min: { lt: string, hash: string, seq: number },
            max: { lt: string, hash: string, seq: number }
        };

        // Update
        if (!existing) {
            existing = {
                min: { lt: acc[1].min.lt.toString(), hash: acc[1].min.hash, seq: acc[1].min.seq },
                max: { lt: acc[1].max.lt.toString(), hash: acc[1].max.hash, seq: acc[1].max.seq }
            };
        } else {
            let minLt = new BN(existing.min.lt);
            let maxLt = new BN(existing.max.lt);
            if (minLt.gt(acc[1].min.lt)) {
                existing.min = { lt: acc[1].min.lt.toString(), hash: acc[1].min.hash, seq: acc[1].min.seq };
            }
            if (maxLt.gt(acc[1].max.lt)) {
                existing.max = { lt: acc[1].max.lt.toString(), hash: acc[1].max.hash, seq: acc[1].max.seq };
            }
        }

        // Persist
        storage.accounts.set(ctx, [acc[0]], existing);
    }
}