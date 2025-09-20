/* global BigInt */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ethers, formatEther } from "ethers";
import abi from "./abi.json";
import Activity from "./Activity";
import "./App.scss";
import logo from "./assets/logo.png";
import mouse from "./assets/mouse.png";
import eth from "./assets/eth.png";

function App({
  connectWallet,
  walletAddress,
  signer,
  contract,
  contractAddress,
}) {
  // ---- States on-chain ----
  const [balanceWei, setBalanceWei] = useState(null);
  const [withdrawIsOpen, setWithdrawIsOpen] = useState(false);
  const [redistributionPrepared, setRedistributionPrepared] = useState(false);
  const [withdrawDuration, setWithdrawDuration] = useState(0);
  const [withdrawsOpenedAt, setWithdrawsOpenedAt] = useState(0);
  const [totalWithdrawnSnapshotWei, setTotalWithdrawnSnapshotWei] =
    useState(0n);

  const [donatedAtCurrentRound, setDonatedAtCurrentRound] = useState("0");
  const [userData, setUserData] = useState(null);
  const [pendingReward, setPendingReward] = useState("0");
  const [remainingTime, setRemainingTime] = useState(null);

  // ---- UI inputs ----
  const [depositAmount, setDepositAmount] = useState("");
  const [donationAmount, setDonationAmount] = useState("");

  // ---- UI status ----
  const [status, setStatus] = useState("");

  const iface = useMemo(() => new ethers.Interface(abi), []);

  // ---- Actions ----
  const requireWallet = async (fn) => {
    if (!signer || !contract) await connectWallet();
    if (signer && contract) await fn();
  };

  const handleDeposit = () =>
    requireWallet(async () => {
      try {
        const value = ethers.parseEther((depositAmount || "0").trim());
        if (value <= 0n) {
          setStatus("❌ No ETH to deposit");
          return;
        }
        const tx = await contract.deposit({ value });
        await tx.wait();
        setDepositAmount("");
        setStatus("✅ Deposited successfully!");
      } catch (e) {
        console.error(e);
        setStatus("❌ Deposit failed: " + (e.reason || e.message));
      }
    });

  const handleDonate = () =>
    requireWallet(async () => {
      try {
        const value = ethers.parseEther((donationAmount || "0").trim());
        if (value <= 0n) {
          setStatus("❌ No ETH to donate");
          return;
        }
        const tx = await contract.addUnwithdrawableETH({ value });
        await tx.wait();
        setDonationAmount("");
        setStatus("✅ Donation sent!");
      } catch (e) {
        console.error(e);
        setStatus("❌ Donation failed: " + (e.reason || e.message));
      }
    });

  const handleWithdraw = () =>
    requireWallet(async () => {
      try {
        const tx = await contract.withdrawAll();
        await tx.wait();
        setStatus("✅ Withdrawn!");
      } catch (e) {
        console.error(e);
        setStatus("❌ Withdraw failed: " + (e.reason || e.message));
      }
    });

  const handleClaim = () =>
    requireWallet(async () => {
      try {
        const tx = await contract.claimReward();
        await tx.wait();
        setStatus("✅ Reward claimed!");
      } catch (e) {
        console.error(e);
        setStatus("❌ Claim failed: " + (e.reason || e.message));
      }
    });

  // ---- Polling ----
  const loadLiveData = useCallback(async () => {
    try {
      const provider = new ethers.JsonRpcProvider(
        "https://arb1.arbitrum.io/rpc"
      );

      const [
        balance,
        snapOpenTs,
        snapIsOpen,
        snapPrepared,
        snapDur,
        snapTotW,
        snapDon,
      ] = await Promise.all([
        provider.getBalance(contractAddress),
        provider.call({
          to: contractAddress,
          data: iface.encodeFunctionData("withdrawsOpenedAt"),
        }),
        provider.call({
          to: contractAddress,
          data: iface.encodeFunctionData("withdrawIsOpen"),
        }),
        provider.call({
          to: contractAddress,
          data: iface.encodeFunctionData("redistributionPrepared"),
        }),
        provider.call({
          to: contractAddress,
          data: iface.encodeFunctionData("withdrawDuration"),
        }),
        provider.call({
          to: contractAddress,
          data: iface.encodeFunctionData("totalWithdrawnSnapshot"),
        }),
        provider.call({
          to: contractAddress,
          data: iface.encodeFunctionData("donatedAtCurrentRound"),
        }),
      ]);

      setBalanceWei(balance);

      const openedAt = Number(
        ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], snapOpenTs)[0]
      );
      setWithdrawsOpenedAt(openedAt);

      setWithdrawIsOpen(
        Boolean(
          ethers.AbiCoder.defaultAbiCoder().decode(["bool"], snapIsOpen)[0]
        )
      );
      setRedistributionPrepared(
        Boolean(
          ethers.AbiCoder.defaultAbiCoder().decode(["bool"], snapPrepared)[0]
        )
      );
      setWithdrawDuration(
        Number(
          ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], snapDur)[0]
        )
      );

      const totWWei = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint256"],
        snapTotW
      )[0];
      setTotalWithdrawnSnapshotWei(totWWei);

      const totalDon = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint256"],
        snapDon
      )[0];
      setDonatedAtCurrentRound(formatEther(totalDon));
    } catch (err) {
      console.error("Live data error", err);
    }
  }, [iface, contractAddress]);

  // ---- User data ----
  const loadUserData = useCallback(async () => {
    if (!walletAddress) {
      setUserData(null);
      setPendingReward("0");
      return;
    }
    try {
      const provider = new ethers.JsonRpcProvider(
        "https://arb1.arbitrum.io/rpc"
      );

      const userRaw = await provider.call({
        to: contractAddress,
        data: iface.encodeFunctionData("getUser", [walletAddress]),
      });
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
        ["uint256", "uint256", "uint256", "bool", "bool"],
        userRaw
      );

      const stakeWei = decoded[0];
      const remainingWei = decoded[1];
      const withdrawnWei = decoded[2];
      const withdrew = decoded[3];
      const claimed = decoded[4];

      setUserData({
        stake: formatEther(stakeWei),
        remaining: formatEther(remainingWei),
        withdrawn: formatEther(withdrawnWei),
        withdrew,
        claimed,
      });

      if (
        redistributionPrepared &&
        !claimed &&
        totalWithdrawnSnapshotWei > 0n
      ) {
        const shareWei =
          (BigInt(balanceWei || 0n) * withdrawnWei) / totalWithdrawnSnapshotWei;
        setPendingReward(formatEther(shareWei));
      } else {
        setPendingReward("0");
      }
    } catch (err) {
      console.error("User data error", err);
    }
  }, [
    walletAddress,
    iface,
    redistributionPrepared,
    totalWithdrawnSnapshotWei,
    balanceWei,
    contractAddress,
  ]);

  // ---- Countdown ----
  useEffect(() => {
    if (!withdrawsOpenedAt || !withdrawDuration) {
      setRemainingTime(null);
      return;
    }
    const end = withdrawsOpenedAt + withdrawDuration;
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const left = end - now;
      setRemainingTime(left > 0 ? left : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [withdrawsOpenedAt, withdrawDuration]);

  // ---- Auto-refresh ----
  useEffect(() => {
    loadLiveData();
    loadUserData();
    const id = setInterval(() => {
      loadLiveData();
      loadUserData();
    }, 5000);
    return () => clearInterval(id);
  }, [loadLiveData, loadUserData]);

  // ---- Helpers ----
  const fmtTime = (secs) => {
    if (secs == null) return "—";
    const s = Math.max(0, Number(secs));
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${ss}`;
  };

  const depositDisabled = withdrawIsOpen || redistributionPrepared;
  const donateDisabled = withdrawIsOpen || redistributionPrepared;
  const withdrawDisabled =
    !withdrawIsOpen || !(userData && Number(userData.remaining) > 0);

  const claimDisabled =
    !redistributionPrepared ||
    !(userData && userData.withdrew) ||
    (userData && userData.claimed) ||
    Number(pendingReward) === 0;

  // ---- UI ----
  return (
    <div className="app-wrapper">
      <div className="top">
        <div
          className="break"
          onClick={() => (window.location.href = "https://pump.fun/board")}
          style={{ cursor: "pointer" }}
        >
          <h2>Buy $break</h2>
          <p>{contractAddress}</p>
          <img id="mouse" src={mouse} alt="mouse" />
        </div>
        <div className="center">
          <img id="logo" src={logo} alt="Logo" />
          <div className="right">
            <h1 className="title">Break the pill</h1>
            <p>From pump.fun to arbitrum</p>
          </div>
        </div>
        <div className="connect">
          <button id="connect" onClick={connectWallet}>
            {walletAddress
              ? `Connected: ${walletAddress.slice(
                  0,
                  6
                )}...${walletAddress.slice(-4)}`
              : "Connect wallet"}
          </button>
        </div>
        <div id="state">
          <p id="value">{status || "—"}</p>
        </div>
      </div>

      <div className="App">
        <div className="flex-app">
          <div className="flex-pill">
            <div className="pills" id="pilla">
              <h2>200K marketcap</h2>
              <p>
                I will permanently lock 100% of the pump.fun creator rewards as
                a creator by clicking on the "tip the pill" button. <br />
                <br />
                The only way for you (and me lol) to get this money back will be
                to lock ETH in this contract so that we can share these funds
                proportionally. <br />
                <br />I will add back 100% of the creator fees for every +200k
                increment <br /> up to...
              </p>
            </div>
            <div className="pills" id="pillb">
              <h2>3M marketcap</h2>
              <p>
                I launch a live pump.fun and open withdrawals for 2 days (I
                can't cheat, it's written in the smart contract). <br />
                Those who have withdrawn their deposits during these 2 days will
                share 100% of the creator fees. <br />
                <br />
                The smart contract will then allow me to launch a second round,
                the market cap targets will be voted on Twitter{" "}
                <span
                  onClick={() =>
                    (window.location.href = "https://x.com/BreakThePill")
                  }
                  style={{ cursor: "pointer" }}
                >
                  {" "}
                  (@BreakThePill)
                </span>{" "}
                .
              </p>
            </div>
          </div>

          <div className="flex-btn">
            <div className="btn-cont">
              {/* Deposit */}
              <div className="card-btn">
                <input
                  type="number"
                  placeholder="ETH"
                  className="value"
                  min="0"
                  step="0.0001"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value.trim())}
                />
                <button
                  className="btn"
                  onClick={handleDeposit}
                  disabled={depositDisabled}
                >
                  <span>Deposit</span>
                </button>
              </div>

              {/* Donate */}
              <div className="card-btn">
                <input
                  type="number"
                  placeholder="ETH"
                  className="value"
                  min="0"
                  step="0.001"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value.trim())}
                />
                <button
                  className="btn"
                  onClick={handleDonate}
                  disabled={donateDisabled}
                >
                  <span>Tip the pill</span>
                </button>
              </div>

              {/* Withdraw */}
              {/* Withdraw */}
              <div className="card-btn">
                <span className="spacer" />
                <button
                  className="btn"
                  onClick={handleWithdraw}
                  disabled={
                    !withdrawIsOpen ||
                    !(userData && Number(userData.remaining) > 0)
                  }
                >
                  <span>Withdraw</span>
                </button>
              </div>

              {/* Claim */}
              <div className="card-btn">
                <span className="spacer" />
                <button
                  className="btn"
                  onClick={handleClaim}
                  disabled={
                    !redistributionPrepared ||
                    !(userData && userData.withdrew) ||
                    (userData && userData.claimed) ||
                    Number(pendingReward) === 0
                  }
                >
                  <span>Claim</span>
                </button>
              </div>

              {/* In the Pill */}
              <div className="card-info">
                <h2 className="instr">In the Pill :</h2>
                <h2 className="val">
                  {balanceWei !== null
                    ? `${Number(formatEther(balanceWei)).toFixed(4)} ETH`
                    : "—"}
                </h2>
              </div>

              {/* Donations */}
              <div className="card-info">
                <h2 className="instr">Donations :</h2>
                <h2 className="val">
                  {donatedAtCurrentRound
                    ? `${Number(donatedAtCurrentRound).toFixed(4)} ETH`
                    : "—"}
                </h2>
              </div>

              {/* Timer */}
              <div className="card-info">
                <h2 className="instr">Timer (2 days) :</h2>
                <h2 className="val">{fmtTime(remainingTime)}</h2>
              </div>

              {/* Stake */}
              <div className="card-info">
                <h2 className="instr">Your Stake :</h2>
                <h2 className="val">
                  {userData
                    ? `${Number(userData.stake).toFixed(4)} ETH`
                    : "..."}
                </h2>
              </div>

              <span>
                <img src={eth} alt="eth-logo" />
              </span>

              <div className="activity">
                <Activity />
              </div>
              <p>
                Want to check the <span>smart contract</span> ?
              </p>
              <span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
