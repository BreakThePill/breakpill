import { useEffect } from "react";
import { ethers } from "ethers";
import abi from "./abi.json";

const CONTRACT_ADDRESS = "0xc58545D2Cd9Cad0aE68CD5F5395bD684351C3237";

// WebSocket provider pour recevoir les events en live
const provider = new ethers.WebSocketProvider("wss://arb1.arbitrum.io/ws");

function useContractEvents(onEvent) {
  useEffect(() => {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);

    // Déposits
    contract.on("Deposited", (user, amount, event) => {
      onEvent({
        type: "Deposited",
        user,
        amount: ethers.formatEther(amount),
        tx: event.transactionHash,
      });
    });

    // Withdraw
    contract.on("Withdrawn", (user, amount, event) => {
      onEvent({
        type: "Withdrawn",
        user,
        amount: ethers.formatEther(amount),
        tx: event.transactionHash,
      });
    });

    // Claimed
    contract.on("Claimed", (user, amount, event) => {
      onEvent({
        type: "Claimed",
        user,
        amount: ethers.formatEther(amount),
        tx: event.transactionHash,
      });
    });

    // Donated
    contract.on("Donated", (from, amount, event) => {
      onEvent({
        type: "Donated",
        user: from,
        amount: ethers.formatEther(amount),
        tx: event.transactionHash,
      });
    });

    // Opened
    contract.on("Opened", (timestamp) => {
      onEvent({
        type: "Opened",
        timestamp: Number(timestamp),
      });
    });

    // Closed
    contract.on("Closed", (poolSnapshot, totalWithdrawnSnapshot) => {
      onEvent({
        type: "Closed",
        poolSnapshot: ethers.formatEther(poolSnapshot),
        totalWithdrawnSnapshot: ethers.formatEther(totalWithdrawnSnapshot),
      });
    });

    // Round reset
    contract.on("RoundReset", (recycled, roundId) => {
      onEvent({
        type: "RoundReset",
        recycled: ethers.formatEther(recycled),
        roundId: Number(roundId),
      });
    });

    // cleanup
    return () => {
      contract.removeAllListeners();
    };
  }, [onEvent]);
}

export default useContractEvents;
