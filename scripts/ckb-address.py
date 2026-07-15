#!/usr/bin/env python3
"""
Derive a CKB address (CKB2021 full format, bech32m) from a Fiber node's
`default_funding_lock_script.args` — i.e. the address you send faucet CKB to so
the node can fund channels.

Usage:  ckb-address.py <lock_args_hex> [ckt|ckb]

The secp256k1_blake160_sighash_all lock is assumed (what fnn uses by default).
Self-tests run on every invocation and abort on mismatch, so a wrong address can
never be printed (and a rate-limited faucet claim wasted).
"""
import hashlib
import sys

# ---- bech32m (BIP-350) ----
CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"


def _polymod(values):
    gen = [0x3B6A57B2, 0x26508E6D, 0x1EA119FA, 0x3D4233DD, 0x2A1462B3]
    chk = 1
    for v in values:
        b = chk >> 25
        chk = ((chk & 0x1FFFFFF) << 5) ^ v
        for i in range(5):
            chk ^= gen[i] if ((b >> i) & 1) else 0
    return chk


def _hrp_expand(hrp):
    return [ord(x) >> 5 for x in hrp] + [0] + [ord(x) & 31 for x in hrp]


def bech32m_encode(hrp, data):
    values = _hrp_expand(hrp) + data
    polymod = _polymod(values + [0, 0, 0, 0, 0, 0]) ^ 0x2BC830A3
    checksum = [(polymod >> 5 * (5 - i)) & 31 for i in range(6)]
    return hrp + "1" + "".join(CHARSET[d] for d in data + checksum)


def convertbits(data, frombits, tobits, pad=True):
    acc = 0
    bits = 0
    ret = []
    maxv = (1 << tobits) - 1
    for b in data:
        acc = (acc << frombits) | b
        bits += frombits
        while bits >= tobits:
            bits -= tobits
            ret.append((acc >> bits) & maxv)
    if pad and bits:
        ret.append((acc << (tobits - bits)) & maxv)
    return ret


# secp256k1_blake160_sighash_all code hash (system script, testnet + mainnet)
SECP_CODE_HASH = bytes.fromhex(
    "9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8"
)
HASH_TYPE_TYPE = 0x01


def address_from_args(args_hex: str, hrp: str = "ckt") -> str:
    args = bytes.fromhex(args_hex[2:] if args_hex.startswith("0x") else args_hex)
    assert len(args) == 20, f"expected 20-byte blake160 lock args, got {len(args)}"
    # CKB2021 full-address payload: 0x00 | code_hash(32) | hash_type(1) | args
    payload = bytes([0x00]) + SECP_CODE_HASH + bytes([HASH_TYPE_TYPE]) + args
    return bech32m_encode(hrp, convertbits(payload, 8, 5, True))


def _self_test():
    assert bech32m_encode("a", []) == "a1lqfn3a", "bech32m self-test failed"
    assert (
        hashlib.blake2b(b"", digest_size=32, person=b"ckb-default-hash").hexdigest()
        == "44f4c69744d5f8c55d642062949dcae49bc4e7ef43d388c5a12f42b5633d163e"
    ), "ckb blake2b self-test failed"
    # Known-good vector: a live fnn node's lock args → its published address.
    assert (
        address_from_args("0xe5c2fb660c92557e033cd43baf75005562d5bdcd")
        == "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq09ctakvryj24lqx0x58whh2qz4vt2mmngyw8udv"
    ), "known-address self-test failed"


if __name__ == "__main__":
    _self_test()
    if len(sys.argv) < 2:
        sys.exit("usage: ckb-address.py <lock_args_hex> [ckt|ckb]")
    print(address_from_args(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "ckt"))
