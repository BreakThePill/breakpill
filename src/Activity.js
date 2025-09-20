import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import "./activity.scss";
import abi from "./abi.json";

const CONTRACT_ADDRESS = "0xbf2CfD0c6b0A96e84ED1Ae5630BE0Fbdd1E2A763";

const Activity = () => {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let interval;

    const fetchEvents = async () => {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

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

        const formatAddr = (addr) => addr.slice(0, 6) + "..." + addr.slice(-4);

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

    fetchEvents(); // Appel initial

    // 🔁 Toutes les 10 secondes
    interval = setInterval(() => {
      fetchEvents();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="activity">
      <ul>
        <h1>Recent activity</h1>
        {events.length === 0 ? (
          <li>Loading activity...</li>
        ) : (
          events.map((e, idx) => (
            <li key={idx}>
              {e.type}: {e.amount} ETH / Address: {e.address}
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default Activity;
