import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./activity.scss";
import abi from "./abi.json";

const Activity = ({ contractAddress }) => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (!contractAddress) return;

    const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
    const contract = new ethers.Contract(contractAddress, abi, provider);

    const fetchEvents = async () => {
      try {
        const latestBlock = await provider.getBlockNumber();
        const fromBlock = latestBlock - 5000;

        const depositEvents = await contract.queryFilter(
          "Deposited",
          fromBlock,
          latestBlock
        );
        const donationEvents = await contract.queryFilter(
          "Donated",
          fromBlock,
          latestBlock
        );
        const withdrawEvents = await contract.queryFilter(
          "Withdrawn",
          fromBlock,
          latestBlock
        );
        const claimedEvents = await contract.queryFilter(
          "Claimed",
          fromBlock,
          latestBlock
        );

        const formatAddr = (addr) =>
          addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "";

        const allEvents = [
          ...depositEvents.map((e) => ({
            type: "Deposit",
            amount: ethers.formatEther(e.args.amount),
            address: formatAddr(e.args.user),
            block: e.blockNumber,
          })),
          ...donationEvents.map((e) => ({
            type: "Donation",
            amount: ethers.formatEther(e.args.amount),
            address: formatAddr(e.args.from),
            block: e.blockNumber,
          })),
          ...withdrawEvents.map((e) => ({
            type: "Withdraw",
            amount: ethers.formatEther(e.args.amount),
            address: formatAddr(e.args.user),
            block: e.blockNumber,
          })),
          ...claimedEvents.map((e) => ({
            type: "Claim",
            amount: ethers.formatEther(e.args.amount),
            address: formatAddr(e.args.user),
            block: e.blockNumber,
          })),
        ];

        const sorted = allEvents.sort((a, b) => b.block - a.block);
        setEvents(sorted.slice(0, 7));
      } catch (err) {
        console.error("Failed to fetch events:", err);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 10000); // toutes les 10s

    return () => clearInterval(interval);
  }, [contractAddress]);

  return (
    <div className="activity">
      <ul>
        <h1>Recent activity</h1>
        {events.length === 0 ? (
          <li>Loading activity...</li>
        ) : (
          events.map((e, idx) => (
            <li key={idx}>
              {e.type}: {Number(e.amount).toFixed(4)} ETH / Address: {e.address}
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default Activity;
