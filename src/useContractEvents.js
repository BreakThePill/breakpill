import { useEffect } from "react";
import { ethers } from "ethers";
import abi from "./abi.json";

const CONTRACT_ADDRESS = "0xcF19b0dfEE32b6e5B4FCe12A91949AbD98848f24";


const provider = new ethers.WebSocketProvider("wss://arb1.arbitrum.io/ws");

function useContractEvents(onEvent) {
  useEffect(() => {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);


    contract.on("Deposited", (user, amount, event) => {
      onEvent({
        type: "Deposited",
        user,
        amount: ethers.formatEther(amount),
        tx: event.transactionHash,
      });
    });


    contract.on("Withdrawn", (user, amount, event) => {
      onEvent({
        type: "Withdrawn",
        user,
        amount: ethers.formatEther(amount),
        tx: event.transactionHash,
      });
    });


    contract.on("Claimed", (user, amount, event) => {
      onEvent({
        type: "Claimed",
        user,
        amount: ethers.formatEther(amount),
        tx: event.transactionHash,
      });
    });


    contract.on("Donated", (from, amount, event) => {
      onEvent({
        type: "Donated",
        user: from,
        amount: ethers.formatEther(amount),
        tx: event.transactionHash,
      });
    });

    contract.on("Opened", (timestamp) => {
      onEvent({
        type: "Opened",
        timestamp: Number(timestamp),
      });
    });


    contract.on("Closed", (poolSnapshot, totalWithdrawnSnapshot) => {
      onEvent({
        type: "Closed",
        poolSnapshot: ethers.formatEther(poolSnapshot),
        totalWithdrawnSnapshot: ethers.formatEther(totalWithdrawnSnapshot),
      });
    });


    contract.on("RoundReset", (recycled, roundId) => {
      onEvent({
        type: "RoundReset",
        recycled: ethers.formatEther(recycled),
        roundId: Number(roundId),
      });
    });


    return () => {
      contract.removeAllListeners();
    };
  }, [onEvent]);
}

export default useContractEvents;
