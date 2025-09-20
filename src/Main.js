import React, { useMemo, useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import abi from "./abi.json";
import App from "./App";

// ---- Adresse unique ici ----
const CONTRACT_ADDRESS = "0xbf2CfD0c6b0A96e84ED1Ae5630BE0Fbdd1E2A763";
const ARB_HEX = "0xa4b1";
const ARB_DEC = 42161n;

const Main = () => {
  const [signer, setSigner] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [contract, setContract] = useState(null);

  const hasMM = typeof window !== "undefined" && !!window.ethereum;
  const provider = useMemo(
    () => (hasMM ? new ethers.BrowserProvider(window.ethereum) : null),
    [hasMM]
  );

  const ensureArbitrum = useCallback(async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARB_HEX }],
      });
    } catch (error) {
      if (error?.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: ARB_HEX,
              chainName: "Arbitrum One",
              rpcUrls: ["https://arb1.arbitrum.io/rpc"],
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
              blockExplorerUrls: ["https://arbiscan.io"],
            },
          ],
        });
      } else {
        throw error;
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    if (!hasMM) {
      alert("Installez MetaMask pour continuer.");
      return;
    }
    try {
      const accounts = await provider.send("eth_requestAccounts", []);
      if (!accounts || accounts.length === 0) {
        alert("Aucun compte détecté.");
        return;
      }

      const network = await provider.getNetwork();
      if (network.chainId !== ARB_DEC) {
        await ensureArbitrum();
      }

      const nextSigner = await provider.getSigner();
      const address = await nextSigner.getAddress();
      const nextContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        abi,
        nextSigner
      );

      setSigner(nextSigner);
      setContract(nextContract);
      setWalletAddress(address);
    } catch (err) {
      console.error("Erreur connexion:", err);
      alert("Échec de connexion. Vérifiez votre wallet.");
    }
  }, [hasMM, provider, ensureArbitrum]);

  useEffect(() => {
    if (!hasMM) return;

    const handleAccounts = async (accs) => {
      if (accs && accs.length > 0) {
        setWalletAddress(accs[0]);

        const nextSigner = await provider.getSigner();
        setSigner(nextSigner);

        const nextContract = new ethers.Contract(
          CONTRACT_ADDRESS,
          abi,
          nextSigner
        );
        setContract(nextContract);
      } else {
        setWalletAddress(null);
        setSigner(null);
        setContract(null);
      }
    };

    const handleChain = async () => {
      try {
        const net = await provider.getNetwork();
        if (net.chainId !== ARB_DEC) {
          await ensureArbitrum();
        }
        if (walletAddress) {
          const nextSigner = await provider.getSigner();
          setSigner(nextSigner);
          setContract(new ethers.Contract(CONTRACT_ADDRESS, abi, nextSigner));
        }
      } catch (e) {
        console.error("Erreur changement de réseau:", e);
      }
    };

    window.ethereum.on("accountsChanged", handleAccounts);
    window.ethereum.on("chainChanged", handleChain);

    return () => {
      try {
        window.ethereum.removeListener("accountsChanged", handleAccounts);
        window.ethereum.removeListener("chainChanged", handleChain);
      } catch {}
    };
  }, [hasMM, provider, ensureArbitrum, signer, walletAddress]);

  return (
    <>
      <App
        connectWallet={connectWallet}
        walletAddress={walletAddress}
        signer={signer}
        contract={contract}
        contractAddress={CONTRACT_ADDRESS} // 👉 centralisé ici
      />
    </>
  );
};

export default Main;
