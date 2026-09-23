import { useState } from "react";
import "./App.css"; // Kept for Vite template compatibility, though styles are in index.css

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
    <div className="dashboard-container">
      <header>
        <h1>WhatsApp Outreach</h1>
        <p>Paste your numbers below. We'll automatically format them and remove duplicates.</p>
      </header>

      <textarea
        className="input-area"
        value={numbersText}
        onChange={(e) => setNumbersText(e.target.value)}
        placeholder="9876543210&#10;9123456789&#10;9988776655"
      />

      <button className="btn-primary" onClick={processNumbers}>
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Process Contacts
      </button>

      {numbers.length > 0 && (
        <>
          <h2>
            Cleaned Contacts
            <span className="badge">{numbers.length} unique</span>
          </h2>

          <div className="contacts-list">
            {numbers.map((number, index) => (
              <div className="contact-item" key={number}>
                <span className="contact-index">{index + 1}.</span>
                <span className="contact-number">{number}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
