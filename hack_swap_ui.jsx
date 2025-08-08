import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const HACKSWAP_ABI = [
  "function getVolatilityFee() view returns (uint256)",
  "function getLatestPrice() view returns (int256)",
  "function swap(uint256 amountIn, uint256 minAmountOut)",
  "function tokenA() view returns (address)",
  "function tokenB() view returns (address)"
];

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

  const CONTRACT_ADDRESS = "0xYourDeployedHackSwapV2";

  useEffect(() => {
    if (!window.ethereum) return;
    const _provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(_provider);
    setSigner(_provider.getSigner());
    _provider.getSigner().getAddress().then(setAddress);
    const _contract = new ethers.Contract(CONTRACT_ADDRESS, HACKSWAP_ABI, _provider);
    setContract(_contract);
  }, []);

  useEffect(() => {
    if (!contract) return;
    const fetchData = async () => {
      const f = await contract.getVolatilityFee();
      const p = await contract.getLatestPrice();
      setFee(f);
      setPrice(Number(p) / 1e8);

      setPriceHistory((prev) => [
        ...prev.slice(-9),
        { time: new Date().toLocaleTimeString(), price: Number(p) / 1e8 },
      ]);
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [contract]);

  const handleAmountChange = (e) => {
    const val = e.target.value;
    setAmountIn(val);
    if (price && fee) {
      const afterFee = (val * (10000 - fee)) / 10000;
      const out = afterFee * price;
      setEstimatedOut(out.toFixed(6));
    }
  };

  const handleSwap = async () => {
    if (!signer || !contract) return;
    const contractWithSigner = contract.connect(signer);
    const tx = await contractWithSigner.swap(
      ethers.utils.parseUnits(amountIn, 18),
      0
    );
    await tx.wait();
    alert("Swap realizado com sucesso!");
  };

  return (
    <main className="max-w-xl mx-auto p-4 space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <h2 className="text-xl font-bold">HackSwap Interface</h2>
          <p>Carteira conectada: {address || "Conectando..."}</p>
          <p>Preço atual (Chainlink): <strong>{price || "..."}</strong></p>
          <p>Taxa dinâmica: <strong>{fee ? `${fee / 100}%` : "..."}</strong></p>
          <Input
            type="number"
            placeholder="Quantos TokenA trocar?"
            value={amountIn}
            onChange={handleAmountChange}
          />
          <p>Estimativa de saída: {estimatedOut || "..."} TokenB</p>
          <Button onClick={handleSwap} disabled={!amountIn}>Fazer Swap</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold mb-2">Histórico de Preço</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={priceHistory}>
              <XAxis dataKey="time" hide={false} />
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
