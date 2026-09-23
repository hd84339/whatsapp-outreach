import { useState } from "react";

function App() {
  const [numbersText, setNumbersText] = useState("");
  const [numbers, setNumbers] = useState([]);

  const processNumbers = () => {
    const rawNumbers = numbersText
      .split(/[\n,]+/)
      .map((number) => number.trim())
      .filter((number) => number !== "");

    const cleanedNumbers = rawNumbers
      .map((number) => number.replace(/\D/g, ""))
      .filter((number) => number.length >= 10);

    const uniqueNumbers = [...new Set(cleanedNumbers)];

    setNumbers(uniqueNumbers);
  };

  return (
    <div className="app">
      <h1>WhatsApp Outreach</h1>

      <p>
        Add multiple WhatsApp numbers
      </p>

      <textarea
        value={numbersText}
        onChange={(e) => setNumbersText(e.target.value)}
        placeholder={`9876543210
9123456789
9988776655`}
        rows="10"
      />

      <br />

      <button onClick={processNumbers}>
        Import Numbers
      </button>

      <h2>
        Contacts: {numbers.length}
      </h2>

      <div>
        {numbers.map((number, index) => (
          <div key={number}>
            {index + 1}. {number}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
