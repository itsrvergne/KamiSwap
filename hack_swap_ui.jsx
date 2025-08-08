import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// ABI do contrato HackSwap
const HACKSWAP_ABI = [
  "function getVolatilityFee() view returns (uint256)",
  "function getLatestPrice() view returns (int256)",
  "function swap(uint256 amountIn, uint256 minAmountOut)",
  "function tokenA() view returns (address)",
  "function tokenB() view returns (address)"
];

// Endereço do contrato (substitua pelo real)
const CONTRACT_ADDRESS = "0xSeuContratoHackSwap";

export default function HackSwapUI() {
  const [provider, setProvider] = useState();
  const [signer, setSigner] = useState();
  const [address, setAddress] = useState();
  const [contract, setContract] = useState();
  const [fee, setFee] = useState();
  const [price, setPrice] = useState();
  const [amountIn, setAmountIn] = useState("");
  const [estimatedOut, setEstimatedOut] = useState();
  const [priceHistory, setPriceHistory] = useState([]);
  const [status, setStatus] = useState("");
  const [networkOk, setNetworkOk] = useState(false);

  // Conectar carteira
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Metamask não encontrado! Instale a extensão para continuar.");
        return;
      }
      const _provider = new ethers.providers.Web3Provider(window.ethereum);
      await _provider.send("eth_requestAccounts", []);
      const _signer = _provider.getSigner();
      const _address = await _signer.getAddress();
      const { chainId } = await _provider.getNetwork();

      // Verifique se a rede é a correta (exemplo: 1 para Ethereum Mainnet)
      if (chainId !== 1) {
        alert("Rede incorreta! Por favor, conecte-se à rede Ethereum Mainnet.");
        setNetworkOk(false);
        return;
      }
      setNetworkOk(true);

      setProvider(_provider);
      setSigner(_signer);
      setAddress(_address);

      const _contract = new ethers.Contract(CONTRACT_ADDRESS, HACKSWAP_ABI, _provider);
      setContract(_contract);
    } catch (error) {
      console.error(error);
      alert("Erro ao conectar a carteira.");
    }
  };

  // Buscar preço e taxa
  useEffect(() => {
    if (!contract) return;
    const fetchData = async () => {
      try {
        const f = await contract.getVolatilityFee();
        const p = await contract.getLatestPrice();
        setFee(f);
        setPrice(Number(p) / 1e8);
        setPriceHistory((prev) => [
          ...prev.slice(-9),
          { time: new Date().toLocaleTimeString(), price: Number(p) / 1e8 },
        ]);
      } catch (err) {
        console.error("Erro ao buscar dados:", err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [contract]);

  // Calcular estimativa
  const handleAmountChange = (e) => {
    const val = e.target.value;
    setAmountIn(val);
    if (price && fee) {
      const afterFee = (val * (10000 - fee)) / 10000;
      const out = afterFee * price;
      setEstimatedOut(out.toFixed(6));
    }
  };

  // Realizar swap com proteção contra slippage
  const handleSwap = async () => {
    if (!signer || !contract) {
      alert("Conecte sua carteira primeiro.");
      return;
    }
    try {
      setStatus("Enviando transação...");
      const contractWithSigner = contract.connect(signer);

      // Proteção: calcula minAmountOut com tolerância de 1% de slippage
      const minAmountOut = estimatedOut
        ? ethers.utils.parseUnits((estimatedOut * 0.99).toString(), 18)
        : 0;

      const tx = await contractWithSigner.swap(
        ethers.utils.parseUnits(amountIn, 18),
        minAmountOut
      );
      setStatus("Aguardando confirmação...");
      await tx.wait();
      setStatus("Swap realizado com sucesso!");
    } catch (err) {
      console.error(err);
      setStatus("Falha na transação.");
    }
  };

  return (
    <main className="max-w-xl mx-auto p-4 space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-xl font-bold">Interface HackSwap</h2>

          {!address ? (
            <Button onClick={connectWallet}>Conectar Carteira</Button>
          ) : (
            <p>Carteira conectada: {address}</p>
          )}

          {networkOk && (
            <>
              <p>Preço atual (Chainlink): <strong>{price || "..."}</strong></p>
              <p>Taxa dinâmica: <strong>{fee ? `${fee / 100}%` : "..."}</strong></p>

              <Input
                type="number"
                placeholder="Quantos TokenA deseja trocar?"
                value={amountIn}
                onChange={handleAmountChange}
              />
              <p>Estimativa de saída: {estimatedOut || "..."} TokenB</p>

              <Button onClick={handleSwap} disabled={!amountIn}>Fazer Swap</Button>
              {status && <p className="text-sm text-gray-500">{status}</p>}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold mb-2">Histórico de Preço</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={priceHistory}>
              <XAxis dataKey="time" />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip />
              <Area type="monotone" dataKey="price" stroke="#8884d8" fill="#8884d8" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </main>
  );
}
