import React, { useState, useRef } from 'react';

export default function App() {
  // 1. სისტემის პარამეტრები
  const [systemSettings, setSystemSettings] = useState({
    lineLength: 50,             // 110კვ ხაზი (კმ)
    at1Nominal: 250,            // AT-1 სიმძლავრე (MVA)
    at2Nominal: 250,            // AT-2 სიმძლავრე (MVA)
    t1Nominal: 63,              // T-1 სიმძლავრე (MVA)
    t2Nominal: 40,              // T-2 სიმძლავრე (MVA)
    lineLength35: 15,           // 35კვ ხაზი (კმ)
    lineLength10: 8,            // 10კვ საქალაქო (კმ)
    lineLengthRegional10: 12    // 10კვ რეგიონული (კმ)
  });

  // ელემენტების ჩართვა/გამორთვის სტატუსები
  const [statuses, setStatuses] = useState({
    AT1: true,
    AT2: true,
    Coupler: true,
    LineA: true,
    T1: true,
    T2: true,
    Bus1: true,
    Bus2: true,
    FeederCity: true,
    FeederReg: true,
    Feeder35: true,
    Motor6: true
  });

  // SCADA ტელემეტრიის საწყისი მდგომარეობა (ნორმალურ რეჟიმში ავარიული ძაბვა არის "-")
  const [telemetry, setTelemetry] = useState({
    currentVal: "414 A",
    voltageVal: "110.0 კვ",
    preFaultCurrentVal: "207 A",
    modeVal: "ნორმალური რეჟიმი",
    modeColor: "#a6e3a1",
    activeProtection: "-",
    faultCurrentVal: "0 A",
    faultVoltageVal: "-",       // გასწორდა: ნორმალურ რეჟიმში ავარიული ძაბვა არ არის
    tripTimeVal: "0.00 წმ",
    faultDistanceVal: "-",
    zeroSeqVal: "0 A",
    faultTypeVal: "ნორმალური",
    comtradeVal: "READY"
  });

  const [sparkPos, setSparkPos] = useState({ x: 0, y: 0, show: false });
  const gridRef = useRef(null);

  const [logs, setLogs] = useState([
    { 
      time: new Date().toLocaleTimeString(), 
      message: "[SCADA] სისტემა ნორმალურ რეჟიმშია. ყველა დაცვა მზადყოფნაშია.", 
      type: "success" 
    }
  ]);

  const nodeRefs = {
    gen: useRef(null),
    at1: useRef(null),
    at2: useRef(null),
    bus110_1: useRef(null),
    bus110_2: useRef(null),
    coupler: useRef(null),
    trans1: useRef(null),
    trans2: useRef(null),
    userA: useRef(null),
    userB: useRef(null),
    userE: useRef(null),
    userC: useRef(null),
    userD: useRef(null)
  };

  const addLog = (message, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, message, type }]);
  };

  const clearLogs = () => {
    setLogs([{ time: new Date().toLocaleTimeString(), message: "🧹 მოვლენათა ჟურნალი გასუფთავებულია.", type: "info" }]);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSystemSettings(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
  };

  // =========================================================
  // 2. ზუსტი დინამიკური გაანგარიშება
  // =========================================================
  
  // 110კვ ეგხ მაგისტრალის დენი
  const lineACurrentVal = (statuses.LineA && statuses.Bus1) 
    ? Math.round(300 * (systemSettings.lineLength / 50)) 
    : 0;

  // ა) დაბალი ძაბვის მხარის რეალური დენები
  const t1_10_city = (statuses.T1 && statuses.Bus1 && statuses.FeederCity) 
    ? Math.round(250 * (systemSettings.t1Nominal / 63) * (8 / systemSettings.lineLength10)) 
    : 0;

  const t1_10_reg = (statuses.T1 && statuses.Bus1 && statuses.FeederReg) 
    ? Math.round(150 * (systemSettings.t1Nominal / 63) * (12 / systemSettings.lineLengthRegional10)) 
    : 0;

  const t2_35_factory = (statuses.T2 && statuses.Bus2 && statuses.Feeder35) 
    ? Math.round(200 * (systemSettings.t2Nominal / 40) * (15 / systemSettings.lineLength35)) 
    : 0;

  const t2_6_motor = (statuses.T2 && statuses.Bus2 && statuses.Motor6) 
    ? Math.round(160 * (systemSettings.t2Nominal / 40)) 
    : 0;

  // ბ) ტრანსფორმატორების ჯამური დენი დაბალი ძაბვის მხარეს
  const t1_LV_TotalCurrent = t1_10_city + t1_10_reg; 

  // გ) ტრანსფორმატორების დენები 110კვ (მაღალ) მხარეს: I_HV = I_LV * (U_LV / U_HV)
  const t1_110_Current = (statuses.T1 && statuses.Bus1) 
    ? Math.round(t1_LV_TotalCurrent * (10 / 110)) 
    : 0;

  const t2_110_Current = (statuses.T2 && statuses.Bus2) 
    ? Math.round(t2_35_factory * (35 / 110) + t2_6_motor * (6 / 110)) 
    : 0;

  // დ) 110კვ სალტეების სრული დატვირთვა
  const total110Load = lineACurrentVal + t1_110_Current + t2_110_Current;

  // ე) ავტოტრანსფორმატორების გადანაწილება 110კვ და 220კვ მხარეებზე
  let at1_110_Current = 0;
  let at2_110_Current = 0;

  if (statuses.AT1 && statuses.AT2) {
    const totalATMVA = systemSettings.at1Nominal + systemSettings.at2Nominal;
    const at1Ratio = totalATMVA > 0 ? systemSettings.at1Nominal / totalATMVA : 0.5;
    const at2Ratio = totalATMVA > 0 ? systemSettings.at2Nominal / totalATMVA : 0.5;
    at1_110_Current = Math.round(total110Load * at1Ratio);
    at2_110_Current = Math.round(total110Load * at2Ratio);
  } else if (statuses.AT1 && !statuses.AT2) {
    at1_110_Current = total110Load;
    at2_110_Current = 0;
  } else if (!statuses.AT1 && statuses.AT2) {
    at1_110_Current = 0;
    at2_110_Current = total110Load;
  } else {
    at1_110_Current = 0;
    at2_110_Current = 0;
  }

  // 220კვ მხარის დენი (ზუსტი ტრანსფორმაციის კოეფიციენტით: I_220 = I_110 * 110 / 220 = 0.5 * I_110)
  const at1_220_Current = Math.round(at1_110_Current * (110 / 220));
  const at2_220_Current = Math.round(at2_110_Current * (110 / 220));

  const recalculateSystem = () => {
    addLog(`⚙️ გადაანგარიშება: AT-1 (220kV/110kV) = ${at1_220_Current}A / ${at1_110_Current}A, T-1 (110kV) = ${t1_110_Current}A.`, 'success');
  };

  // =========================================================
  // 3. ავარიული რეჟიმების იმიტაცია და SCADA განახლება
  // =========================================================
  const triggerFault = (faultType) => {
    let nodeKey = null;
    let faultData = {};

    switch(faultType) {
      case 'at1_diff':
        nodeKey = 'at1';
        faultData = {
          relay: "SEL-487E (87AT)", fCurrent: "14,500 A", fVoltage: "18.5 კვ", preCurrent: `${at1_110_Current} A`,
          time: "0.03 წმ", dist: "-", zeroSeq: "0 A", type: "87AT დიფერენციალური", mode: "AT-1 ავარია",
          logMsg: "🚨 [87AT] AT-1 შიდა მოკლე შერთვა! AT-1 გათიშულია.", statusUpdate: { AT1: false }
        };
        break;

      case 'at2_diff':
        nodeKey = 'at2';
        faultData = {
          relay: "SEL-487E (87AT)", fCurrent: "14,200 A", fVoltage: "19.1 კვ", preCurrent: `${at2_110_Current} A`,
          time: "0.03 წმ", dist: "-", zeroSeq: "0 A", type: "87AT დიფერენციალური", mode: "AT-2 ავარია",
          logMsg: "🚨 [87AT] AT-2 შიდა მოკლე შერთვა! AT-2 გათიშულია.", statusUpdate: { AT2: false }
        };
        break;

      case 'bus1_fault':
        nodeKey = 'bus110_1';
        faultData = {
          relay: "SEL-487B (87B)", fCurrent: "24,500 A", fVoltage: "0.0 კვ", preCurrent: `${at1_110_Current} A`,
          time: "0.015 წმ", dist: "-", zeroSeq: "0 A", type: "87B შინების დიფერენციალური", mode: "110კვ I სექციის მ.შ.",
          logMsg: "🚨 [87B] 110კვ I სექციის მოკლე შერთვა! Q-110 და AT-1 გაითიშა.", statusUpdate: { Bus1: false, Coupler: false, AT1: false, LineA: false, T1: false }
        };
        break;

      case 'bus2_fault':
        nodeKey = 'bus110_2';
        faultData = {
          relay: "SEL-487B (87B)", fCurrent: "23,800 A", fVoltage: "0.0 კვ", preCurrent: `${at2_110_Current} A`,
          time: "0.015 წმ", dist: "-", zeroSeq: "0 A", type: "87B შინების დიფერენციალური", mode: "110კვ II სექციის მ.შ.",
          logMsg: "🚨 [87B] 110კვ II სექციის მოკლე შერთვა! Q-110 და AT-2 გაითიშა.", statusUpdate: { Bus2: false, Coupler: false, AT2: false, T2: false }
        };
        break;

      case 'line_a_fault':
        nodeKey = 'userA';
        faultData = {
          relay: "SEL-311L (21/87L)", fCurrent: "11,800 A", fVoltage: "32.0 კვ", preCurrent: `${lineACurrentVal} A`,
          time: "0.025 წმ", dist: `${(systemSettings.lineLength * 0.35).toFixed(1)} კმ`, zeroSeq: "120 A", type: "21 დისტანციური დაცვა", mode: "110კვ ეგხ ავარია",
          logMsg: "🚨 [21] 110კვ ეგხ მაგისტრალის მოკლე შერთვა! ხაზი გათიშულია.", statusUpdate: { LineA: false }
        };
        break;

      case 't1_fault':
        nodeKey = 'trans1';
        faultData = {
          relay: "SEL-487E (87T)", fCurrent: "5,400 A", fVoltage: "12.0 კვ", preCurrent: `${t1_110_Current} A`,
          time: "0.03 წმ", dist: "-", zeroSeq: "0 A", type: "87T დიფერენციალური", mode: "T-1 ტრანსფ. ავარია",
          logMsg: "🚨 [87T] ტრანსფორმატორ T-1-ის შიდა ავარია! T-1 გაითიშა.", statusUpdate: { T1: false }
        };
        break;

      case 't2_fault':
        nodeKey = 'trans2';
        faultData = {
          relay: "SEL-487E (87T)", fCurrent: "4,900 A", fVoltage: "15.0 კვ", preCurrent: `${t2_110_Current} A`,
          time: "0.03 წმ", dist: "-", zeroSeq: "0 A", type: "87T დიფერენციალური", mode: "T-2 ტრანსფ. ავარია",
          logMsg: "🚨 [87T] ტრანსფორმატორ T-2-ის შიდა ავარია! T-2 გაითიშა.", statusUpdate: { T2: false }
        };
        break;

      case 'line_35_fault':
        nodeKey = 'userC';
        faultData = {
          relay: "SEL-421 (21)", fCurrent: "3,600 A", fVoltage: "8.5 კვ", preCurrent: `${t2_35_factory} A`,
          time: "0.02 წმ", dist: `${(systemSettings.lineLength35 * 0.4).toFixed(1)} კმ`, zeroSeq: "15 A", type: "21 დისტანციური დაცვა", mode: "35კვ ხაზის ავარია",
          logMsg: "🚨 [21] 35კვ ქარხნის ხაზის ავარია! ხაზი გათიშულია.", statusUpdate: { Feeder35: false }
        };
        break;

      case 'feeder_city_fault':
        nodeKey = 'userB';
        faultData = {
          relay: "SEL-351A (50/51)", fCurrent: "1,200 A", fVoltage: "2.1 კვ", preCurrent: `${t1_10_city} A`,
          time: "0.35 წმ", dist: "-", zeroSeq: "0 A", type: "50/51 მაქსიმალური დენური", mode: "10კვ საქალაქო ავარია",
          logMsg: "🚨 [50/51] 10კვ საქალაქო ფიდერის ჭარბი დენი! ფიდერი გაითიშა.", statusUpdate: { FeederCity: false }
        };
        break;

      case 'feeder_reg_fault':
        nodeKey = 'userE';
        faultData = {
          relay: "SEL-351S (67N)", fCurrent: "65 A", fVoltage: "9.8 კვ", preCurrent: `${t1_10_reg} A`,
          time: "0.50 წმ", dist: "-", zeroSeq: "65 A", type: "67N მიწაზე მიმართული", mode: "10კვ რეგიონული მიწაზე",
          logMsg: "🚨 [67N] 10კვ რეგიონული ფიდერის მიწაზე შერთვა! ფიდერი გაითიშა.", statusUpdate: { FeederReg: false }
        };
        break;

      case 'motor_fault':
        nodeKey = 'userD';
        faultData = {
          relay: "SEL-701 (49/50/51)", fCurrent: "890 A", fVoltage: "3.2 კვ", preCurrent: `${t2_6_motor} A`,
          time: "0.80 წმ", dist: "-", zeroSeq: "0 A", type: "49/51 თერმული / ჭარბი დენი", mode: "6კვ ძრავას ავარია",
          logMsg: "🚨 [701] 6კვ ასინქრონული ძრავას გადატვირთვა! ძრავა გაჩერდა.", statusUpdate: { Motor6: false }
        };
        break;

      case 'bus_coupler_fault':
        nodeKey = 'coupler';
        faultData = {
          relay: "SEL-451", fCurrent: "0 A", fVoltage: "-", preCurrent: "0 A",
          time: "0.01 წმ", dist: "-", zeroSeq: "0 A", type: "ყალბი გამორთვა (Spurious)", mode: "Q-110 ყალბი გამორთვა",
          logMsg: "⚠️ [FALSE TRIP] სექციური ამომრთველის Q-110 ყალბი გამორთვა!", statusUpdate: { Coupler: false }
        };
        break;

      default:
        return;
    }

    if (gridRef.current && nodeKey && nodeRefs[nodeKey]?.current) {
      const gridRect = gridRef.current.getBoundingClientRect();
      const nodeRect = nodeRefs[nodeKey].current.getBoundingClientRect();
      setSparkPos({
        x: nodeRect.left - gridRect.left + nodeRect.width / 2,
        y: nodeRect.top - gridRect.top + nodeRect.height / 2,
        show: true
      });
    }

    setTelemetry({
      currentVal: faultData.fCurrent,
      voltageVal: faultData.fVoltage,
      preFaultCurrentVal: faultData.preCurrent,
      modeVal: faultData.mode,
      modeColor: faultType === 'bus_coupler_fault' ? "#f9e2af" : "#f38ba8",
      activeProtection: faultData.relay,
      faultCurrentVal: faultData.fCurrent,
      faultVoltageVal: faultData.fVoltage, // შეივსება მხოლოს რეალური ავარიისას
      tripTimeVal: faultData.time,
      faultDistanceVal: faultData.dist,
      zeroSeqVal: faultData.zeroSeq,
      faultTypeVal: faultData.type,
      comtradeVal: "SAVED (C001)"
    });

    addLog(faultData.logMsg, faultType === 'bus_coupler_fault' ? 'warn' : 'danger');

    setTimeout(() => {
      setSparkPos(prev => ({ ...prev, show: false }));
      setStatuses(prev => ({ ...prev, ...faultData.statusUpdate }));
    }, 300);
  };

  const resetSystem = () => {
    setStatuses({
      AT1: true, AT2: true, Coupler: true, LineA: true, T1: true, T2: true,
      Bus1: true, Bus2: true, FeederCity: true, FeederReg: true, Feeder35: true, Motor6: true
    });
    setTelemetry({
      currentVal: "414 A", voltageVal: "110.0 კვ", preFaultCurrentVal: "207 A",
      modeVal: "ნორმალური რეჟიმი", modeColor: "#a6e3a1", activeProtection: "-",
      faultCurrentVal: "0 A", faultVoltageVal: "-", tripTimeVal: "0.00 წმ",
      faultDistanceVal: "-", zeroSeqVal: "0 A", faultTypeVal: "ნორმალური", comtradeVal: "READY"
    });
    setSparkPos({ x: 0, y: 0, show: false });
    addLog("🔄 [SCADA] სისტემა სრულად აღდგენილია საწყის რეჟიმში.", 'success');
  };

  return (
    <div className="w-screen min-h-screen bg-[#0f0f14] p-3 flex flex-col box-border m-0 overflow-x-hidden font-sans text-[#cdd6f4]">
      
      {/* სათაური */}
      <h1 className="text-[#89b4fa] text-[18px] mb-[10px] font-bold text-center flex items-center justify-center gap-2">
        <span>⚡</span> SEL რელეების კვანძური ქვესადგურის ინტელექტუალური მოდელი
      </h1>

      {/* Control Panel (2x4 Grid) */}
      <div className="bg-[#161622] p-[12px] rounded-[6px] mb-[10px] border border-[#313244] shadow-md flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-3 items-center">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[#cdd6f4] text-[11px] whitespace-nowrap">🛣️ 110კვ ხაზი (კმ):</label>
            <input type="number" name="lineLength" value={systemSettings.lineLength} onChange={handleInputChange} className="w-[70px] bg-[#1e1e2e] text-[#cdd6f4] border border-[#45475a] p-[3px_6px] rounded text-center text-[11px]" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-[#cdd6f4] text-[11px] whitespace-nowrap">🌀 AT-2 სიმძლავრე (MVA):</label>
            <input type="number" name="at2Nominal" value={systemSettings.at2Nominal} onChange={handleInputChange} className="w-[70px] bg-[#1e1e2e] text-[#cdd6f4] border border-[#45475a] p-[3px_6px] rounded text-center text-[11px]" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-[#cdd6f4] text-[11px] whitespace-nowrap">⚡ T-2 სიმძლავრე (MVA):</label>
            <input type="number" name="t2Nominal" value={systemSettings.t2Nominal} onChange={handleInputChange} className="w-[70px] bg-[#1e1e2e] text-[#cdd6f4] border border-[#45475a] p-[3px_6px] rounded text-center text-[11px]" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-[#cdd6f4] text-[11px] whitespace-nowrap">🏙️ 10კვ საქალაქო (კმ):</label>
            <input type="number" name="lineLength10" value={systemSettings.lineLength10} onChange={handleInputChange} className="w-[70px] bg-[#1e1e2e] text-[#cdd6f4] border border-[#45475a] p-[3px_6px] rounded text-center text-[11px]" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-[#cdd6f4] text-[11px] whitespace-nowrap">🌀 AT-1 სიმძლავრე (MVA):</label>
            <input type="number" name="at1Nominal" value={systemSettings.at1Nominal} onChange={handleInputChange} className="w-[70px] bg-[#1e1e2e] text-[#cdd6f4] border border-[#45475a] p-[3px_6px] rounded text-center text-[11px]" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-[#cdd6f4] text-[11px] whitespace-nowrap">⚡ T-1 სიმძლავრე (MVA):</label>
            <input type="number" name="t1Nominal" value={systemSettings.t1Nominal} onChange={handleInputChange} className="w-[70px] bg-[#1e1e2e] text-[#cdd6f4] border border-[#45475a] p-[3px_6px] rounded text-center text-[11px]" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-[#cdd6f4] text-[11px] whitespace-nowrap">🏭 35კვ ხაზი (კმ):</label>
            <input type="number" name="lineLength35" value={systemSettings.lineLength35} onChange={handleInputChange} className="w-[70px] bg-[#1e1e2e] text-[#cdd6f4] border border-[#45475a] p-[3px_6px] rounded text-center text-[11px]" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <label className="text-[#cdd6f4] text-[11px] whitespace-nowrap">📐 10კვ რეგიონული (კმ):</label>
            <input type="number" name="lineLengthRegional10" value={systemSettings.lineLengthRegional10} onChange={handleInputChange} className="w-[70px] bg-[#1e1e2e] text-[#cdd6f4] border border-[#45475a] p-[3px_6px] rounded text-center text-[11px]" />
          </div>
        </div>

        <div className="flex justify-end mt-1">
          <button 
            onClick={recalculateSystem} 
            className="cursor-pointer bg-[#89b4fa] text-[#11111b] border-none px-6 py-1.5 rounded-[4px] font-bold text-[11px] hover:bg-[#74c7ec] transition-colors flex items-center gap-1 shadow"
          >
            📊 გადაანგარიშება
          </button>
        </div>
      </div>

      {/* Main Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-[10px] w-full flex-1">
        
        {/* Left Panel */}
        <div className="bg-[#161622] rounded-[6px] p-[10px] shadow-lg border border-[#313244] flex flex-col">
          <h3 className="mt-0 text-[#89b4fa] border-b border-[#313244] pb-[4px] text-[13px] font-bold flex items-center gap-1">
            🌐 ქვესადგურის ტექნოლოგიური სქემა
          </h3>
          
          <div className="bg-[#07070a] border border-[#313244] rounded-[6px] h-[500px] relative overflow-hidden mt-[8px]" ref={gridRef}>
            
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-[1]">
              <defs>
                <marker id="arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#a6e3a1" />
                </marker>
                <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f38ba8" />
                </marker>
              </defs>

              {/* AT Flows */}
              <path className={statuses.AT1 ? "flow-line active" : "flow-line tripped"} d="M 235 32 L 235 105" markerEnd={statuses.AT1 ? "url(#arrow-green)" : "url(#arrow-red)"} />
              <path className={statuses.AT1 && statuses.Bus1 ? "flow-line active" : "flow-line tripped"} d="M 235 165 L 235 220" markerEnd={statuses.AT1 && statuses.Bus1 ? "url(#arrow-green)" : "url(#arrow-red)"} />

              <path className={statuses.AT2 ? "flow-line active" : "flow-line tripped"} d="M 705 32 L 705 105" markerEnd={statuses.AT2 ? "url(#arrow-green)" : "url(#arrow-red)"} />
              <path className={statuses.AT2 && statuses.Bus2 ? "flow-line active" : "flow-line tripped"} d="M 705 165 L 705 220" markerEnd={statuses.AT2 && statuses.Bus2 ? "url(#arrow-green)" : "url(#arrow-red)"} />

              {/* Coupler Flow */}
              <path className={statuses.Coupler ? "flow-line active" : "flow-line tripped"} d="M 360 220 L 470 205 L 580 220" />
              
              {/* Feeder Flows */}
              <path className={statuses.LineA && statuses.Bus1 ? "flow-line active" : "flow-line tripped"} d="M 165 220 L 165 310" markerEnd={statuses.LineA && statuses.Bus1 ? "url(#arrow-green)" : "url(#arrow-red)"} />
              <path className={statuses.T1 && statuses.Bus1 ? "flow-line active" : "flow-line tripped"} d="M 320 220 L 320 310" markerEnd={statuses.T1 && statuses.Bus1 ? "url(#arrow-green)" : "url(#arrow-red)"} />
              <path className={statuses.T2 && statuses.Bus2 ? "flow-line active" : "flow-line tripped"} d="M 620 220 L 620 310" markerEnd={statuses.T2 && statuses.Bus2 ? "url(#arrow-green)" : "url(#arrow-red)"} />
              
              <path className={statuses.T1 && statuses.FeederCity ? "flow-line active" : "flow-line tripped"} d="M 320 385 L 235 450" markerEnd={statuses.T1 && statuses.FeederCity ? "url(#arrow-green)" : "url(#arrow-red)"} />
              <path className={statuses.T1 && statuses.FeederReg ? "flow-line active" : "flow-line tripped"} d="M 320 385 L 405 450" markerEnd={statuses.T1 && statuses.FeederReg ? "url(#arrow-green)" : "url(#arrow-red)"} />
              <path className={statuses.T2 && statuses.Feeder35 ? "flow-line active" : "flow-line tripped"} d="M 620 385 L 535 450" markerEnd={statuses.T2 && statuses.Feeder35 ? "url(#arrow-green)" : "url(#arrow-red)"} />
              <path className={statuses.T2 && statuses.Motor6 ? "flow-line active" : "flow-line tripped"} d="M 620 385 L 705 450" markerEnd={statuses.T2 && statuses.Motor6 ? "url(#arrow-green)" : "url(#arrow-red)"} />

              {/* AT-1 & AT-2 220kV მხარის დენები (შესასვლელი) */}
              <text x="180" y="80" fill={statuses.AT1 ? "#a6e3a1" : "#f38ba8"} fontSize="9px" fontFamily="monospace" fontWeight="bold">{`⬇ 220kV: ${at1_220_Current} A`}</text>
              <text x="650" y="80" fill={statuses.AT2 ? "#a6e3a1" : "#f38ba8"} fontSize="9px" fontFamily="monospace" fontWeight="bold">{`⬇ 220kV: ${at2_220_Current} A`}</text>

              {/* AT-1 & AT-2 110kV მხარის დენები (გამოსასვლელი სალტეზე - 2-ჯერ მეტი დენი) */}
              <text x="245" y="195" fill={statuses.AT1 && statuses.Bus1 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ 110kV: ${at1_110_Current} A`}</text>
              <text x="595" y="195" fill={statuses.AT2 && statuses.Bus2 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ 110kV: ${at2_110_Current} A`}</text>

              <text x="140" y="275" fill={statuses.LineA && statuses.Bus1 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${lineACurrentVal} A`}</text>
              
              {/* T-1 და T-2 მაღალ (110კვ) მხარეს დენები */}
              <text x="330" y="275" fill={statuses.T1 && statuses.Bus1 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${t1_110_Current} A (110kV)`}</text>
              <text x="630" y="275" fill={statuses.T2 && statuses.Bus2 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${t2_110_Current} A (110kV)`}</text>

              {/* დაბალ ძაბვაზე ცალკეული ფიდერების დენები */}
              <text x="195" y="425" fill={statuses.T1 && statuses.FeederCity ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${t1_10_city} A`}</text>
              <text x="365" y="425" fill={statuses.T1 && statuses.FeederReg ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${t1_10_reg} A`}</text>
              <text x="495" y="425" fill={statuses.T2 && statuses.Feeder35 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${t2_35_factory} A`}</text>
              <text x="665" y="425" fill={statuses.T2 && statuses.Motor6 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${t2_6_motor} A`}</text>
            </svg>

            {sparkPos.show && (
              <div className="absolute text-[24px] z-[5] -translate-x-1/2 -translate-y-1/2 animate-ping" style={{ left: sparkPos.x, top: sparkPos.y }}>⚡</div>
            )}

            {/* 220kV Bus */}
            <div className="absolute bg-[#fab387] h-[6px] rounded-[3px] z-[2] top-[26px] left-[17%] w-[70%]" ref={nodeRefs.gen}>
              <span className="absolute -top-[16px] left-[10px] text-[10px] font-bold text-[#cdd6f4]">220 კვ სისტემური სალტე</span>
            </div>

            {/* AT-1 & AT-2 */}
            <div className={`absolute flex flex-col items-center p-[4px] rounded-[4px] text-center z-[3] w-[130px] border ${statuses.AT1 ? 'bg-[#1e1e2e] border-[#fab387]' : 'bg-[#2a171e] border-[#f38ba8]'}`} ref={nodeRefs.at1} style={{ left: '170px', top: '105px' }}>
              <div className="text-[9px] font-bold text-[#cdd6f4]">AT-1 (220/110 კვ)</div>
              <div className="bg-[#11111b] text-[#fab387] font-mono text-[8px] px-[3px] py-[1px] rounded mt-[2px] border border-[#313244]">SEL-487E</div>
              <div className="text-[7px] font-bold mt-[1px]" style={{ color: statuses.AT1 ? '#a6e3a1' : '#f38ba8' }}>{statuses.AT1 ? 'ჩართულია' : 'გათიშულია (0A)'}</div>
            </div>

            <div className={`absolute flex flex-col items-center p-[4px] rounded-[4px] text-center z-[3] w-[130px] border ${statuses.AT2 ? 'bg-[#1e1e2e] border-[#fab387]' : 'bg-[#2a171e] border-[#f38ba8]'}`} ref={nodeRefs.at2} style={{ left: '640px', top: '105px' }}>
              <div className="text-[9px] font-bold text-[#cdd6f4]">AT-2 (220/110 კვ)</div>
              <div className="bg-[#11111b] text-[#fab387] font-mono text-[8px] px-[3px] py-[1px] rounded mt-[2px] border border-[#313244]">SEL-487E</div>
              <div className="text-[7px] font-bold mt-[1px]" style={{ color: statuses.AT2 ? '#a6e3a1' : '#f38ba8' }}>{statuses.AT2 ? 'ჩართულია' : 'გათიშულია (0A)'}</div>
            </div>

            {/* 110kV Bus Sections */}
            <div className={`absolute h-[6px] rounded-[3px] z-[2] left-[8%] top-[220px] w-[35%] ${statuses.Bus1 ? 'bg-[#89b4fa]' : 'bg-[#f38ba8]'}`} ref={nodeRefs.bus110_1}>
              <span className="absolute -top-[16px] left-[5px] text-[9px] font-bold text-[#cdd6f4]">110 კვ სალტე - I სექცია</span>
            </div>

            <div className={`absolute flex flex-col items-center p-[3px_6px] rounded-[4px] text-center z-[3] w-[110px] border ${statuses.Coupler ? 'bg-[#242535] border-[#89b4fa]' : 'bg-[#2a171e] border-[#f38ba8]'}`} ref={nodeRefs.coupler} style={{ left: '45%', top: '198px' }}>
              <div className="text-[8px] font-bold">⏹️ სექციური Q-110</div>
              <div className="bg-[#11111b] text-[#fab387] font-mono text-[7px] px-[2px] py-[1px] rounded mt-[1px]">SEL-451</div>
              <div className="text-[7px] font-bold mt-[1px]" style={{ color: statuses.Coupler ? '#a6e3a1' : '#f38ba8' }}>
                {statuses.Coupler ? 'ჩართულია' : 'გამორთულია'}
              </div>
            </div>

            <div className={`absolute h-[6px] rounded-[3px] z-[2] left-[57%] top-[220px] w-[35%] ${statuses.Bus2 ? 'bg-[#89b4fa]' : 'bg-[#f38ba8]'}`} ref={nodeRefs.bus110_2}>
              <span className="absolute -top-[16px] left-[5px] text-[9px] font-bold text-[#cdd6f4]">110 კვ სალტე - II სექცია</span>
            </div>

            {/* Feeders & Transformers */}
            <div className={`absolute flex flex-col items-center p-[4px] rounded-[4px] text-center z-[3] w-[120px] border ${statuses.LineA && statuses.Bus1 ? 'bg-[#1e1e2e] border-[#a6e3a1]' : 'bg-[#2a171e] border-[#f38ba8]'}`} ref={nodeRefs.userA} style={{ left: '105px', top: '310px' }}>
              <div className="text-[8px] font-bold text-[#cdd6f4]">🛣️ ეგხ "მაგისტრალი ა"</div>
              <div className="bg-[#11111b] text-[#fab387] font-mono text-[7px] px-[2px] py-[1px] rounded mt-[1px]">SEL-311L</div>
              <div className="text-[7px] font-bold mt-[1px]" style={{ color: statuses.LineA && statuses.Bus1 ? '#a6e3a1' : '#f38ba8' }}>{statuses.LineA && statuses.Bus1 ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            {/* T-1 Block with dynamic LV & HV current readouts */}
            <div className={`absolute flex flex-col items-center p-[4px] rounded-[4px] text-center z-[3] w-[125px] border ${statuses.T1 && statuses.Bus1 ? 'bg-[#1e1e2e] border-[#f9e2af]' : 'bg-[#2a171e] border-[#f38ba8]'}`} ref={nodeRefs.trans1} style={{ left: '260px', top: '310px' }}>
              <div className="text-[8px] font-bold text-[#cdd6f4]">⚡ ტრანსფ. T-1 (110/10კვ)</div>
              <div className="bg-[#11111b] text-[#fab387] font-mono text-[7px] px-[2px] py-[1px] rounded mt-[1px]">SEL-487E</div>
              <div className="text-[7px] font-mono mt-[2px] text-[#89b4fa]">{`10kV: ${t1_LV_TotalCurrent}A | 110kV: ${t1_110_Current}A`}</div>
              <div className="text-[7px] font-bold mt-[1px]" style={{ color: statuses.T1 && statuses.Bus1 ? '#a6e3a1' : '#f38ba8' }}>{statuses.T1 && statuses.Bus1 ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            {/* T-2 Block with dynamic LV & HV current readouts */}
            <div className={`absolute flex flex-col items-center p-[4px] rounded-[4px] text-center z-[3] w-[125px] border ${statuses.T2 && statuses.Bus2 ? 'bg-[#1e1e2e] border-[#f9e2af]' : 'bg-[#2a171e] border-[#f38ba8]'}`} ref={nodeRefs.trans2} style={{ left: '560px', top: '310px' }}>
              <div className="text-[8px] font-bold text-[#cdd6f4]">⚡ ტრანსფ. T-2 (110/35/6კვ)</div>
              <div className="bg-[#11111b] text-[#fab387] font-mono text-[7px] px-[2px] py-[1px] rounded mt-[1px]">SEL-487E</div>
              <div className="text-[7px] font-mono mt-[2px] text-[#89b4fa]">{`110kV: ${t2_110_Current}A`}</div>
              <div className="text-[7px] font-bold mt-[1px]" style={{ color: statuses.T2 && statuses.Bus2 ? '#a6e3a1' : '#f38ba8' }}>{statuses.T2 && statuses.Bus2 ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div className={`absolute flex flex-col items-center p-[4px] rounded-[4px] text-center z-[3] w-[115px] border ${statuses.T1 && statuses.FeederCity ? 'bg-[#1e1e2e] border-[#a6e3a1]' : 'bg-[#2a171e] border-[#f38ba8]'}`} ref={nodeRefs.userB} style={{ left: '175px', top: '450px' }}>
              <div className="text-[8px] font-bold text-[#cdd6f4]">🏙️ ქალაქის ფიდერი (10 კვ)</div>
              <div className="bg-[#11111b] text-[#fab387] font-mono text-[7px] px-[2px] py-[1px] rounded mt-[1px]">SEL-351A</div>
              <div className="text-[7px] font-bold mt-[1px]" style={{ color: statuses.T1 && statuses.FeederCity ? '#a6e3a1' : '#f38ba8' }}>{statuses.T1 && statuses.FeederCity ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div className={`absolute flex flex-col items-center p-[4px] rounded-[4px] text-center z-[3] w-[120px] border ${statuses.T1 && statuses.FeederReg ? 'bg-[#1e1e2e] border-[#a6e3a1]' : 'bg-[#2a171e] border-[#f38ba8]'}`} ref={nodeRefs.userE} style={{ left: '345px', top: '450px' }}>
              <div className="text-[8px] font-bold text-[#cdd6f4]">📐 რეგიონული ფიდერი (10 კვ)</div>
              <div className="bg-[#11111b] text-[#fab387] font-mono text-[7px] px-[2px] py-[1px] rounded mt-[1px]">SEL-351S</div>
              <div className="text-[7px] font-bold mt-[1px]" style={{ color: statuses.T1 && statuses.FeederReg ? '#a6e3a1' : '#f38ba8' }}>{statuses.T1 && statuses.FeederReg ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div className={`absolute flex flex-col items-center p-[4px] rounded-[4px] text-center z-[3] w-[115px] border ${statuses.T2 && statuses.Feeder35 ? 'bg-[#1e1e2e] border-[#a6e3a1]' : 'bg-[#2a171e] border-[#f38ba8]'}`} ref={nodeRefs.userC} style={{ left: '480px', top: '450px' }}>
              <div className="text-[8px] font-bold text-[#cdd6f4]">🏭 ქარხნის ხაზი (35 კვ)</div>
              <div className="bg-[#11111b] text-[#fab387] font-mono text-[7px] px-[2px] py-[1px] rounded mt-[1px]">SEL-421</div>
              <div className="text-[7px] font-bold mt-[1px]" style={{ color: statuses.T2 && statuses.Feeder35 ? '#a6e3a1' : '#f38ba8' }}>{statuses.T2 && statuses.Feeder35 ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div className={`absolute flex flex-col items-center p-[4px] rounded-[4px] text-center z-[3] w-[115px] border ${statuses.T2 && statuses.Motor6 ? 'bg-[#1e1e2e] border-[#a6e3a1]' : 'bg-[#2a171e] border-[#f38ba8]'}`} ref={nodeRefs.userD} style={{ left: '650px', top: '450px' }}>
              <div className="text-[8px] font-bold text-[#cdd6f4]">⚙️ ასინქ. ძრავა (6 კვ)</div>
              <div className="bg-[#11111b] text-[#fab387] font-mono text-[7px] px-[2px] py-[1px] rounded mt-[1px]">SEL-701</div>
              <div className="text-[7px] font-bold mt-[1px]" style={{ color: statuses.T2 && statuses.Motor6 ? '#a6e3a1' : '#f38ba8' }}>{statuses.T2 && statuses.Motor6 ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div className="absolute bottom-[6px] right-[10px] text-[9px] text-[#a6adc8] font-mono opacity-80">
              <span>👨‍🔬 ავტორი: ბორის ჯინჭველეიშვილი</span>
            </div>
          </div>

          {/* Fault Simulation Buttons */}
          <h3 className="mt-[10px] text-[#89b4fa] border-b border-[#313244] pb-[4px] text-[12px] font-bold">💥 ავარიული რეჟიმების იმიტაცია</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-[5px] mt-[6px]">
            <button className="bg-[#1e1e2e] border border-[#f38ba8] text-white p-[5px] rounded text-left text-[9px] font-bold cursor-pointer hover:bg-[#f38ba8] hover:text-black transition-colors" onClick={() => triggerFault('at1_diff')}>🌀 AT-1 დიფერენციალური (87AT)</button>
            <button className="bg-[#1e1e2e] border border-[#f38ba8] text-white p-[5px] rounded text-left text-[9px] font-bold cursor-pointer hover:bg-[#f38ba8] hover:text-black transition-colors" onClick={() => triggerFault('at2_diff')}>🌀 AT-2 დიფერენციალური (87AT)</button>
            <button className="bg-[#1e1e2e] border border-[#f38ba8] text-white p-[5px] rounded text-left text-[9px] font-bold cursor-pointer hover:bg-[#f38ba8] hover:text-black transition-colors" onClick={() => triggerFault('bus1_fault')}>⚡ 110კვ I სექციის მ.შ. (87B)</button>
            <button className="bg-[#1e1e2e] border border-[#f38ba8] text-white p-[5px] rounded text-left text-[9px] font-bold cursor-pointer hover:bg-[#f38ba8] hover:text-black transition-colors" onClick={() => triggerFault('bus2_fault')}>⚡ 110კვ II სექციის მ.შ. (87B)</button>
            <button className="bg-[#1e1e2e] border border-[#f38ba8] text-white p-[5px] rounded text-left text-[9px] font-bold cursor-pointer hover:bg-[#f38ba8] hover:text-black transition-colors" onClick={() => triggerFault('line_a_fault')}>🛣️ 110კვ "მაგისტრალი ა" (21)</button>
            <button className="bg-[#1e1e2e] border border-[#f38ba8] text-white p-[5px] rounded text-left text-[9px] font-bold cursor-pointer hover:bg-[#f38ba8] hover:text-black transition-colors" onClick={() => triggerFault('t1_fault')}>⚡ ტრანსფორმატორი T-1 (87T)</button>
            <button className="bg-[#1e1e2e] border border-[#f38ba8] text-white p-[5px] rounded text-left text-[9px] font-bold cursor-pointer hover:bg-[#f38ba8] hover:text-black transition-colors" onClick={() => triggerFault('t2_fault')}>⚡ ტრანსფორმატორი T-2 (87T)</button>
            <button className="bg-[#1e1e2e] border border-[#f38ba8] text-white p-[5px] rounded text-left text-[9px] font-bold cursor-pointer hover:bg-[#f38ba8] hover:text-black transition-colors" onClick={() => triggerFault('line_35_fault')}>🏭 35კვ ქარხნის ხაზი (21)</button>
            <button className="bg-[#1e1e2e] border border-[#f38ba8] text-white p-[5px] rounded text-left text-[9px] font-bold cursor-pointer hover:bg-[#f38ba8] hover:text-black transition-colors" onClick={() => triggerFault('feeder_city_fault')}>🏙️ 10კვ საქალაქო ფიდერი (50/51)</button>
            <button className="bg-[#1e1e2e] border border-[#f38ba8] text-white p-[5px] rounded text-left text-[9px] font-bold cursor-pointer hover:bg-[#f38ba8] hover:text-black transition-colors" onClick={() => triggerFault('feeder_reg_fault')}>📐 10კვ რეგიონული ფიდერი (67N)</button>
            <button className="bg-[#1e1e2e] border border-[#f38ba8] text-white p-[5px] rounded text-left text-[9px] font-bold cursor-pointer hover:bg-[#f38ba8] hover:text-black transition-colors" onClick={() => triggerFault('motor_fault')}>⚙️ 6კვ ასინქრონული ძრავა (701)</button>
            <button className="bg-[#1e1e2e] border border-[#f9e2af] text-[#f9e2af] p-[5px] rounded text-left text-[9px] font-bold cursor-pointer hover:bg-[#f9e2af] hover:text-black transition-colors" onClick={() => triggerFault('bus_coupler_fault')}>⏹️ სექციური Q-110 (ყალბი გამორთვა)</button>
          </div>
        </div>

        {/* Right Side Panel: SCADA telemetry & Logs */}
        <div className="bg-[#161622] rounded-[6px] p-[10px] shadow-lg border border-[#313244] flex flex-col gap-3">
          
          <button className="bg-[#a6e3a1] text-[#11111b] text-[12px] w-full p-[8px] rounded font-bold cursor-pointer hover:bg-[#90d98b] transition-colors flex items-center justify-center gap-1 shadow" onClick={resetSystem}>
            🔄 სისტემის სრული აღდგენა (Reset)
          </button>

          {/* SCADA Telemetry Block */}
          <div className="bg-[#0b0b12] rounded p-[8px] border border-[#313244]">
            <h3 className="m-0 text-[11px] text-[#89b4fa] font-bold border-b border-[#313244] pb-[4px] mb-[6px] flex items-center justify-between">
              <span>📡 SCADA ტელემეტრია & ავარიის მონაცემები</span>
              <span className="text-[9px] px-[4px] py-[1px] rounded bg-[#1e1e2e]" style={{ color: telemetry.modeColor }}>{telemetry.modeVal}</span>
            </h3>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 font-mono text-[9px]">
              <div className="bg-[#161622] p-[4px] rounded border border-[#222330]">
                <span className="text-[#a6adc8] block">🛡️ აქტიური დაცვა:</span>
                <span className="text-[#fab387] font-bold">{telemetry.activeProtection}</span>
              </div>
              <div className="bg-[#161622] p-[4px] rounded border border-[#222330]">
                <span className="text-[#a6adc8] block">📋 ავარიის ტიპი:</span>
                <span className="text-[#cdd6f4] font-bold">{telemetry.faultTypeVal}</span>
              </div>
              <div className="bg-[#161622] p-[4px] rounded border border-[#222330]">
                <span className="text-[#a6adc8] block">💥 ავარიის დენი ($I_f$):</span>
                <span className="text-[#f38ba8] font-bold">{telemetry.faultCurrentVal}</span>
              </div>
              <div className="bg-[#161622] p-[4px] rounded border border-[#222330]">
                <span className="text-[#a6adc8] block">📉 ავარიული ძაბვა:</span>
                <span className="text-[#f9e2af] font-bold">{telemetry.faultVoltageVal}</span>
              </div>
              <div className="bg-[#161622] p-[4px] rounded border border-[#222330]">
                <span className="text-[#a6adc8] block">⏱️ გამორთვის დრო:</span>
                <span className="text-[#a6e3a1] font-bold">{telemetry.tripTimeVal}</span>
              </div>
              <div className="bg-[#161622] p-[4px] rounded border border-[#222330]">
                <span className="text-[#a6adc8] block">📍 ავარიის მანძილი:</span>
                <span className="text-[#89b4fa] font-bold">{telemetry.faultDistanceVal}</span>
              </div>
              <div className="bg-[#161622] p-[4px] rounded border border-[#222330]">
                <span className="text-[#a6adc8] block">🌀 ნულოვანი დენი ($I_0$):</span>
                <span className="text-[#cdd6f4] font-bold">{telemetry.zeroSeqVal}</span>
              </div>
              <div className="bg-[#161622] p-[4px] rounded border border-[#222330]">
                <span className="text-[#a6adc8] block">📁 COMTRADE ჩანაწერი:</span>
                <span className="text-[#b4befe] font-bold">{telemetry.comtradeVal}</span>
              </div>
            </div>
          </div>

          {/* Event Log */}
          <div className="flex-1 flex flex-col bg-[#07070a] rounded p-[8px] border border-[#222330] min-h-[160px]">
            <div className="flex justify-between items-center mb-[4px]">
              <h3 className="m-0 text-[11px] text-[#89b4fa] font-bold flex items-center gap-1">
                📜 მოვლენათა ჟურნალი
              </h3>
              <button className="bg-transparent text-white cursor-pointer p-[2px] rounded text-[11px] hover:bg-[#313244]" onClick={clearLogs}>🗑️</button>
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-[9px]">
              {logs.map((log, index) => (
                <div key={index} className="mb-[3px] leading-[1.3]" style={{ color: log.type === 'success' ? '#a6e3a1' : log.type === 'warn' ? '#f9e2af' : log.type === 'danger' ? '#f38ba8' : '#cdd6f4' }}>
                  <code>[{log.time}] {log.message}</code>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}