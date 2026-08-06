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

  // SCADA ტელემეტრიის საწყისი მდგომარეობა
  const [telemetry, setTelemetry] = useState({
    currentVal: "414 A",
    voltageVal: "110.0 კვ",
    preFaultCurrentVal: "207 A",
    modeVal: "ნორმალური რეჟიმი",
    modeColor: "#a6e3a1",
    activeProtection: "-",
    faultCurrentVal: "0 A",
    faultVoltageVal: "-",
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
  // 2. დინამიკური გაანგარიშება
  // =========================================================
  const lineACurrentVal = (statuses.LineA && statuses.Bus1) 
    ? Math.round(300 * (systemSettings.lineLength / 50)) 
    : 0;

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

  const t1_LV_TotalCurrent = t1_10_city + t1_10_reg; 

  const t1_110_Current = (statuses.T1 && statuses.Bus1) 
    ? Math.round(t1_LV_TotalCurrent * (10 / 110)) 
    : 0;

  const t2_110_Current = (statuses.T2 && statuses.Bus2) 
    ? Math.round(t2_35_factory * (35 / 110) + t2_6_motor * (6 / 110)) 
    : 0;

  const total110Load = lineACurrentVal + t1_110_Current + t2_110_Current;

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

  const at1_220_Current = Math.round(at1_110_Current * (110 / 220));
  const at2_220_Current = Math.round(at2_110_Current * (110 / 220));

  const recalculateSystem = () => {
    addLog(`⚙️ გადაანგარიშება: AT-1 (220kV/110kV) = ${at1_220_Current}A / ${at1_110_Current}A, T-1 (110kV) = ${t1_110_Current}A.`, 'success');
  };

  // =========================================================
  // 3. ავარიების სიმულაცია
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
      faultVoltageVal: faultData.fVoltage,
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
    <div style={{ width: '100vw', minHeight: '100vh', backgroundColor: '#0f0f14', padding: '12px', boxSizing: 'border-box', fontFamily: 'sans-serif', color: '#cdd6f4' }}>
      
      {/* CSS სტილების იძულებითი აღდგენა Tailwind Reset-ის დასაძლევად */}
      <style>{`
        .flow-line { stroke-dasharray: 6,6; stroke-width: 2.5; animation: dash 1s linear infinite; }
        .flow-line.active { stroke: #a6e3a1; }
        .flow-line.tripped { stroke: #f38ba8; stroke-dasharray: none; }
        @keyframes dash { to { stroke-dashoffset: -12; } }
      `}</style>

      {/* სათაური */}
      <h1 style={{ color: '#89b4fa', fontSize: '18px', marginBottom: '10px', marginTop: 0, fontWeight: 'bold', textAlign: 'center' }}>
        ⚡ SEL რელეების კვანძური ქვესადგურის ინტელექტუალური მოდელი
      </h1>

      {/* Control Panel - მკაცრი 2 სვეტიანი / 4 სვეტიანი Grid */}
      <div style={{ backgroundColor: '#161622', padding: '12px', borderRadius: '6px', marginBottom: '10px', border: '1px solid #313244', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px 16px', alignItems: 'center' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11px' }}>🛣️ 110კვ ხაზი (კმ):</label>
            <input type="number" name="lineLength" value={systemSettings.lineLength} onChange={handleInputChange} style={{ width: '70px', backgroundColor: '#1e1e2e', color: '#cdd6f4', border: '1px solid #45475a', padding: '3px 6px', borderRadius: '4px', textAlign: 'center', fontSize: '11px' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11px' }}>🌀 AT-2 სიმძლავრე (MVA):</label>
            <input type="number" name="at2Nominal" value={systemSettings.at2Nominal} onChange={handleInputChange} style={{ width: '70px', backgroundColor: '#1e1e2e', color: '#cdd6f4', border: '1px solid #45475a', padding: '3px 6px', borderRadius: '4px', textAlign: 'center', fontSize: '11px' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11px' }}>⚡ T-2 სიმძლავრე (MVA):</label>
            <input type="number" name="t2Nominal" value={systemSettings.t2Nominal} onChange={handleInputChange} style={{ width: '70px', backgroundColor: '#1e1e2e', color: '#cdd6f4', border: '1px solid #45475a', padding: '3px 6px', borderRadius: '4px', textAlign: 'center', fontSize: '11px' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11px' }}>🏙️ 10კვ საქალაქო (კმ):</label>
            <input type="number" name="lineLength10" value={systemSettings.lineLength10} onChange={handleInputChange} style={{ width: '70px', backgroundColor: '#1e1e2e', color: '#cdd6f4', border: '1px solid #45475a', padding: '3px 6px', borderRadius: '4px', textAlign: 'center', fontSize: '11px' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11px' }}>🌀 AT-1 სიმძლავრე (MVA):</label>
            <input type="number" name="at1Nominal" value={systemSettings.at1Nominal} onChange={handleInputChange} style={{ width: '70px', backgroundColor: '#1e1e2e', color: '#cdd6f4', border: '1px solid #45475a', padding: '3px 6px', borderRadius: '4px', textAlign: 'center', fontSize: '11px' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11px' }}>⚡ T-1 სიმძლავრე (MVA):</label>
            <input type="number" name="t1Nominal" value={systemSettings.t1Nominal} onChange={handleInputChange} style={{ width: '70px', backgroundColor: '#1e1e2e', color: '#cdd6f4', border: '1px solid #45475a', padding: '3px 6px', borderRadius: '4px', textAlign: 'center', fontSize: '11px' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11px' }}>🏭 35კვ ხაზი (კმ):</label>
            <input type="number" name="lineLength35" value={systemSettings.lineLength35} onChange={handleInputChange} style={{ width: '70px', backgroundColor: '#1e1e2e', color: '#cdd6f4', border: '1px solid #45475a', padding: '3px 6px', borderRadius: '4px', textAlign: 'center', fontSize: '11px' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11px' }}>📐 10კვ რეგიონული (კმ):</label>
            <input type="number" name="lineLengthRegional10" value={systemSettings.lineLengthRegional10} onChange={handleInputChange} style={{ width: '70px', backgroundColor: '#1e1e2e', color: '#cdd6f4', border: '1px solid #45475a', padding: '3px 6px', borderRadius: '4px', textAlign: 'center', fontSize: '11px' }} />
          </div>

        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button 
            onClick={recalculateSystem} 
            style={{ cursor: 'pointer', backgroundColor: '#89b4fa', color: '#11111b', border: 'none', padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}
          >
            📊 გადაანგარიშება
          </button>
        </div>
      </div>

      {/* 2-სვეტიანი მთავარი განლაგება (სქემა მარცხნივ, SCADA/Logs მარჯვნივ) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '10px', width: '100%' }}>
        
        {/* მარცხენა პანელი: სქემა და ავარიები */}
        <div style={{ backgroundColor: '#161622', borderRadius: '6px', padding: '10px', border: '1px solid #313244' }}>
          <h3 style={{ margin: 0, color: '#89b4fa', borderBottom: '1px solid #313244', paddingBottom: '4px', fontSize: '13px', fontWeight: 'bold' }}>
            🌐 ქვესადგურის ტექნოლოგიური სქემა
          </h3>
          
          <div style={{ backgroundColor: '#07070a', border: '1px solid #313244', borderRadius: '6px', height: '500px', relative: 'relative', position: 'relative', overflow: 'hidden', marginTop: '8px' }} ref={gridRef}>
            
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
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

              {/* დენების წარწერები */}
              <text x="180" y="80" fill={statuses.AT1 ? "#a6e3a1" : "#f38ba8"} fontSize="9px" fontFamily="monospace" fontWeight="bold">{`⬇ 220kV: ${at1_220_Current} A`}</text>
              <text x="650" y="80" fill={statuses.AT2 ? "#a6e3a1" : "#f38ba8"} fontSize="9px" fontFamily="monospace" fontWeight="bold">{`⬇ 220kV: ${at2_220_Current} A`}</text>

              <text x="245" y="195" fill={statuses.AT1 && statuses.Bus1 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ 110kV: ${at1_110_Current} A`}</text>
              <text x="595" y="195" fill={statuses.AT2 && statuses.Bus2 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ 110kV: ${at2_110_Current} A`}</text>

              <text x="140" y="275" fill={statuses.LineA && statuses.Bus1 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${lineACurrentVal} A`}</text>
              
              <text x="330" y="275" fill={statuses.T1 && statuses.Bus1 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${t1_110_Current} A (110kV)`}</text>
              <text x="630" y="275" fill={statuses.T2 && statuses.Bus2 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${t2_110_Current} A (110kV)`}</text>

              <text x="195" y="425" fill={statuses.T1 && statuses.FeederCity ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${t1_10_city} A`}</text>
              <text x="365" y="425" fill={statuses.T1 && statuses.FeederReg ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${t1_10_reg} A`}</text>
              <text x="495" y="425" fill={statuses.T2 && statuses.Feeder35 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${t2_35_factory} A`}</text>
              <text x="665" y="425" fill={statuses.T2 && statuses.Motor6 ? "#a6e3a1" : "#f38ba8"} fontSize="10px" fontFamily="monospace" fontWeight="bold">{`⬇ ${t2_6_motor} A`}</text>
            </svg>

            {sparkPos.show && (
              <div style={{ position: 'absolute', fontSize: '24px', zIndex: 5, transform: 'translate(-50%, -50%)', left: sparkPos.x, top: sparkPos.y }}>⚡</div>
            )}

            {/* 220kV Bus */}
            <div style={{ position: 'absolute', backgroundColor: '#fab387', height: '6px', borderRadius: '3px', zIndex: 2, top: '26px', left: '17%', width: '70%' }} ref={nodeRefs.gen}>
              <span style={{ position: 'absolute', top: '-16px', left: '10px', fontSize: '10px', fontWeight: 'bold', color: '#cdd6f4' }}>220 კვ სისტემური სალტე</span>
            </div>

            {/* AT-1 & AT-2 */}
            <div ref={nodeRefs.at1} style={{ position: 'absolute', left: '170px', top: '105px', width: '130px', padding: '4px', borderRadius: '4px', textAlign: 'center', zIndex: 3, border: '1px solid', backgroundColor: statuses.AT1 ? '#1e1e2e' : '#2a171e', borderColor: statuses.AT1 ? '#fab387' : '#f38ba8' }}>
              <div style={{ fontSize: '9px', fontWeight: 'bold' }}>AT-1 (220/110 კვ)</div>
              <div style={{ backgroundColor: '#11111b', color: '#fab387', fontFamily: 'monospace', fontSize: '8px', padding: '1px 3px', borderRadius: '2px', marginTop: '2px' }}>SEL-487E</div>
              <div style={{ fontSize: '7px', fontWeight: 'bold', marginTop: '1px', color: statuses.AT1 ? '#a6e3a1' : '#f38ba8' }}>{statuses.AT1 ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div ref={nodeRefs.at2} style={{ position: 'absolute', left: '640px', top: '105px', width: '130px', padding: '4px', borderRadius: '4px', textAlign: 'center', zIndex: 3, border: '1px solid', backgroundColor: statuses.AT2 ? '#1e1e2e' : '#2a171e', borderColor: statuses.AT2 ? '#fab387' : '#f38ba8' }}>
              <div style={{ fontSize: '9px', fontWeight: 'bold' }}>AT-2 (220/110 კვ)</div>
              <div style={{ backgroundColor: '#11111b', color: '#fab387', fontFamily: 'monospace', fontSize: '8px', padding: '1px 3px', borderRadius: '2px', marginTop: '2px' }}>SEL-487E</div>
              <div style={{ fontSize: '7px', fontWeight: 'bold', marginTop: '1px', color: statuses.AT2 ? '#a6e3a1' : '#f38ba8' }}>{statuses.AT2 ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            {/* 110kV Bus Sections */}
            <div ref={nodeRefs.bus110_1} style={{ position: 'absolute', height: '6px', borderRadius: '3px', zIndex: 2, left: '8%', top: '220px', width: '35%', backgroundColor: statuses.Bus1 ? '#89b4fa' : '#f38ba8' }}>
              <span style={{ position: 'absolute', top: '-16px', left: '5px', fontSize: '9px', fontWeight: 'bold' }}>110 კვ სალტე - I სექცია</span>
            </div>

            <div ref={nodeRefs.coupler} style={{ position: 'absolute', left: '45%', top: '198px', width: '110px', padding: '3px 6px', borderRadius: '4px', textAlign: 'center', zIndex: 3, border: '1px solid', backgroundColor: statuses.Coupler ? '#242535' : '#2a171e', borderColor: statuses.Coupler ? '#89b4fa' : '#f38ba8' }}>
              <div style={{ fontSize: '8px', fontWeight: 'bold' }}>⏹️ სექციური Q-110</div>
              <div style={{ backgroundColor: '#11111b', color: '#fab387', fontFamily: 'monospace', fontSize: '7px', padding: '1px 2px', borderRadius: '2px', marginTop: '1px' }}>SEL-451</div>
              <div style={{ fontSize: '7px', fontWeight: 'bold', marginTop: '1px', color: statuses.Coupler ? '#a6e3a1' : '#f38ba8' }}>{statuses.Coupler ? 'ჩართულია' : 'გამორთულია'}</div>
            </div>

            <div ref={nodeRefs.bus110_2} style={{ position: 'absolute', height: '6px', borderRadius: '3px', zIndex: 2, left: '57%', top: '220px', width: '35%', backgroundColor: statuses.Bus2 ? '#89b4fa' : '#f38ba8' }}>
              <span style={{ position: 'absolute', top: '-16px', left: '5px', fontSize: '9px', fontWeight: 'bold' }}>110 კვ სალტე - II სექცია</span>
            </div>

            {/* Feeders & Transformers */}
            <div ref={nodeRefs.userA} style={{ position: 'absolute', left: '105px', top: '310px', width: '120px', padding: '4px', borderRadius: '4px', textAlign: 'center', zIndex: 3, border: '1px solid', backgroundColor: statuses.LineA && statuses.Bus1 ? '#1e1e2e' : '#2a171e', borderColor: statuses.LineA && statuses.Bus1 ? '#a6e3a1' : '#f38ba8' }}>
              <div style={{ fontSize: '8px', fontWeight: 'bold' }}>🛣️ ეგხ "მაგისტრალი ა"</div>
              <div style={{ backgroundColor: '#11111b', color: '#fab387', fontFamily: 'monospace', fontSize: '7px', padding: '1px 2px', borderRadius: '2px', marginTop: '1px' }}>SEL-311L</div>
              <div style={{ fontSize: '7px', fontWeight: 'bold', marginTop: '1px', color: statuses.LineA && statuses.Bus1 ? '#a6e3a1' : '#f38ba8' }}>{statuses.LineA && statuses.Bus1 ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div ref={nodeRefs.trans1} style={{ position: 'absolute', left: '260px', top: '310px', width: '125px', padding: '4px', borderRadius: '4px', textAlign: 'center', zIndex: 3, border: '1px solid', backgroundColor: statuses.T1 && statuses.Bus1 ? '#1e1e2e' : '#2a171e', borderColor: statuses.T1 && statuses.Bus1 ? '#f9e2af' : '#f38ba8' }}>
              <div style={{ fontSize: '8px', fontWeight: 'bold' }}>⚡ ტრანსფ. T-1 (110/10კვ)</div>
              <div style={{ backgroundColor: '#11111b', color: '#fab387', fontFamily: 'monospace', fontSize: '7px', padding: '1px 2px', borderRadius: '2px', marginTop: '1px' }}>SEL-487E</div>
              <div style={{ fontSize: '7px', fontWeight: 'bold', marginTop: '1px', color: statuses.T1 && statuses.Bus1 ? '#a6e3a1' : '#f38ba8' }}>{statuses.T1 && statuses.Bus1 ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div ref={nodeRefs.trans2} style={{ position: 'absolute', left: '560px', top: '310px', width: '125px', padding: '4px', borderRadius: '4px', textAlign: 'center', zIndex: 3, border: '1px solid', backgroundColor: statuses.T2 && statuses.Bus2 ? '#1e1e2e' : '#2a171e', borderColor: statuses.T2 && statuses.Bus2 ? '#f9e2af' : '#f38ba8' }}>
              <div style={{ fontSize: '8px', fontWeight: 'bold' }}>⚡ ტრანსფ. T-2 (110/35/6კვ)</div>
              <div style={{ backgroundColor: '#11111b', color: '#fab387', fontFamily: 'monospace', fontSize: '7px', padding: '1px 2px', borderRadius: '2px', marginTop: '1px' }}>SEL-487E</div>
              <div style={{ fontSize: '7px', fontWeight: 'bold', marginTop: '1px', color: statuses.T2 && statuses.Bus2 ? '#a6e3a1' : '#f38ba8' }}>{statuses.T2 && statuses.Bus2 ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div ref={nodeRefs.userB} style={{ position: 'absolute', left: '175px', top: '450px', width: '115px', padding: '4px', borderRadius: '4px', textAlign: 'center', zIndex: 3, border: '1px solid', backgroundColor: statuses.T1 && statuses.FeederCity ? '#1e1e2e' : '#2a171e', borderColor: statuses.T1 && statuses.FeederCity ? '#a6e3a1' : '#f38ba8' }}>
              <div style={{ fontSize: '8px', fontWeight: 'bold' }}>🏙️ ქალაქის ფიდერი (10 კვ)</div>
              <div style={{ backgroundColor: '#11111b', color: '#fab387', fontFamily: 'monospace', fontSize: '7px', padding: '1px 2px', borderRadius: '2px', marginTop: '1px' }}>SEL-351A</div>
              <div style={{ fontSize: '7px', fontWeight: 'bold', marginTop: '1px', color: statuses.T1 && statuses.FeederCity ? '#a6e3a1' : '#f38ba8' }}>{statuses.T1 && statuses.FeederCity ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div ref={nodeRefs.userE} style={{ position: 'absolute', left: '345px', top: '450px', width: '120px', padding: '4px', borderRadius: '4px', textAlign: 'center', zIndex: 3, border: '1px solid', backgroundColor: statuses.T1 && statuses.FeederReg ? '#1e1e2e' : '#2a171e', borderColor: statuses.T1 && statuses.FeederReg ? '#a6e3a1' : '#f38ba8' }}>
              <div style={{ fontSize: '8px', fontWeight: 'bold' }}>📐 რეგიონული ფიდერი (10 კვ)</div>
              <div style={{ backgroundColor: '#11111b', color: '#fab387', fontFamily: 'monospace', fontSize: '7px', padding: '1px 2px', borderRadius: '2px', marginTop: '1px' }}>SEL-351S</div>
              <div style={{ fontSize: '7px', fontWeight: 'bold', marginTop: '1px', color: statuses.T1 && statuses.FeederReg ? '#a6e3a1' : '#f38ba8' }}>{statuses.T1 && statuses.FeederReg ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div ref={nodeRefs.userC} style={{ position: 'absolute', left: '480px', top: '450px', width: '115px', padding: '4px', borderRadius: '4px', textAlign: 'center', zIndex: 3, border: '1px solid', backgroundColor: statuses.T2 && statuses.Feeder35 ? '#1e1e2e' : '#2a171e', borderColor: statuses.T2 && statuses.Feeder35 ? '#a6e3a1' : '#f38ba8' }}>
              <div style={{ fontSize: '8px', fontWeight: 'bold' }}>🏭 ქარხნის ხაზი (35 კვ)</div>
              <div style={{ backgroundColor: '#11111b', color: '#fab387', fontFamily: 'monospace', fontSize: '7px', padding: '1px 2px', borderRadius: '2px', marginTop: '1px' }}>SEL-421</div>
              <div style={{ fontSize: '7px', fontWeight: 'bold', marginTop: '1px', color: statuses.T2 && statuses.Feeder35 ? '#a6e3a1' : '#f38ba8' }}>{statuses.T2 && statuses.Feeder35 ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div ref={nodeRefs.userD} style={{ position: 'absolute', left: '650px', top: '450px', width: '115px', padding: '4px', borderRadius: '4px', textAlign: 'center', zIndex: 3, border: '1px solid', backgroundColor: statuses.T2 && statuses.Motor6 ? '#1e1e2e' : '#2a171e', borderColor: statuses.T2 && statuses.Motor6 ? '#a6e3a1' : '#f38ba8' }}>
              <div style={{ fontSize: '8px', fontWeight: 'bold' }}>⚙️ ასინქ. ძრავა (6 კვ)</div>
              <div style={{ backgroundColor: '#11111b', color: '#fab387', fontFamily: 'monospace', fontSize: '7px', padding: '1px 2px', borderRadius: '2px', marginTop: '1px' }}>SEL-701</div>
              <div style={{ fontSize: '7px', fontWeight: 'bold', marginTop: '1px', color: statuses.T2 && statuses.Motor6 ? '#a6e3a1' : '#f38ba8' }}>{statuses.T2 && statuses.Motor6 ? 'ჩართულია' : 'გათიშულია'}</div>
            </div>

            <div style={{ position: 'absolute', bottom: '6px', right: '10px', fontSize: '9px', color: '#a6adc8', fontFamily: 'monospace' }}>
              <span>👨‍🔬 ავტორი: ბორის ჯინჭველეიშვილი</span>
            </div>
          </div>

          {/* ავარიის ღილაკები - 2 სვეტიანი ბადე */}
          <h3 style={{ marginTop: '10px', color: '#89b4fa', borderBottom: '1px solid #313244', paddingBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>💥 ავარიული რეჟიმების იმიტაცია</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px', marginTop: '6px' }}>
            <button style={{ backgroundColor: '#1e1e2e', border: '1px solid #f38ba8', color: '#fff', padding: '5px', borderRadius: '4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => triggerFault('at1_diff')}>🌀 AT-1 დიფერენციალური (87AT)</button>
            <button style={{ backgroundColor: '#1e1e2e', border: '1px solid #f38ba8', color: '#fff', padding: '5px', borderRadius: '4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => triggerFault('at2_diff')}>🌀 AT-2 დიფერენციალური (87AT)</button>
            <button style={{ backgroundColor: '#1e1e2e', border: '1px solid #f38ba8', color: '#fff', padding: '5px', borderRadius: '4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => triggerFault('bus1_fault')}>⚡ 110კვ I სექციის მ.შ. (87B)</button>
            <button style={{ backgroundColor: '#1e1e2e', border: '1px solid #f38ba8', color: '#fff', padding: '5px', borderRadius: '4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => triggerFault('bus2_fault')}>⚡ 110კვ II სექციის მ.შ. (87B)</button>
            <button style={{ backgroundColor: '#1e1e2e', border: '1px solid #f38ba8', color: '#fff', padding: '5px', borderRadius: '4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => triggerFault('line_a_fault')}>🛣️ 110კვ "მაგისტრალი ა" (21)</button>
            <button style={{ backgroundColor: '#1e1e2e', border: '1px solid #f38ba8', color: '#fff', padding: '5px', borderRadius: '4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => triggerFault('t1_fault')}>⚡ ტრანსფორმატორი T-1 (87T)</button>
            <button style={{ backgroundColor: '#1e1e2e', border: '1px solid #f38ba8', color: '#fff', padding: '5px', borderRadius: '4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => triggerFault('t2_fault')}>⚡ ტრანსფორმატორი T-2 (87T)</button>
            <button style={{ backgroundColor: '#1e1e2e', border: '1px solid #f38ba8', color: '#fff', padding: '5px', borderRadius: '4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => triggerFault('line_35_fault')}>🏭 35კვ ქარხნის ხაზი (21)</button>
            <button style={{ backgroundColor: '#1e1e2e', border: '1px solid #f38ba8', color: '#fff', padding: '5px', borderRadius: '4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => triggerFault('feeder_city_fault')}>🏙️ 10კვ საქალაქო ფიდერი (50/51)</button>
            <button style={{ backgroundColor: '#1e1e2e', border: '1px solid #f38ba8', color: '#fff', padding: '5px', borderRadius: '4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => triggerFault('feeder_reg_fault')}>📐 10კვ რეგიონული ფიდერი (67N)</button>
            <button style={{ backgroundColor: '#1e1e2e', border: '1px solid #f38ba8', color: '#fff', padding: '5px', borderRadius: '4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => triggerFault('motor_fault')}>⚙️ 6კვ ასინქრონული ძრავა (701)</button>
            <button style={{ backgroundColor: '#1e1e2e', border: '1px solid #f9e2af', color: '#f9e2af', padding: '5px', borderRadius: '4px', textAlign: 'left', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer' }} onClick={() => triggerFault('bus_coupler_fault')}>⏹️ სექციური Q-110 (ყალბი გამორთვა)</button>
          </div>
        </div>

        {/* მარჯვენა პანელი: SCADA ტელემეტრია და ლოგები */}
        <div style={{ backgroundColor: '#161622', borderRadius: '6px', padding: '10px', border: '1px solid #313244', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          <button style={{ backgroundColor: '#a6e3a1', color: '#11111b', fontSize: '12px', width: '100%', padding: '8px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', border: 'none' }} onClick={resetSystem}>
            🔄 სისტემის სრული აღდგენა (Reset)
          </button>

          {/* SCADA Telemetry Block */}
          <div style={{ backgroundColor: '#0b0b12', borderRadius: '4px', padding: '8px', border: '1px solid #313244' }}>
            <h3 style={{ margin: 0, fontSize: '11px', color: '#89b4fa', fontWeight: 'bold', borderBottom: '1px solid #313244', paddingBottom: '4px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>📡 SCADA ტელემეტრია</span>
              <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '2px', backgroundColor: '#1e1e2e', color: telemetry.modeColor }}>{telemetry.modeVal}</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontFamily: 'monospace', fontSize: '9px' }}>
              <div style={{ backgroundColor: '#161622', padding: '4px', borderRadius: '4px', border: '1px solid #222330' }}>
                <span style={{ color: '#a6adc8', display: 'block' }}>🛡️ აქტიური დაცვა:</span>
                <span style={{ color: '#fab387', fontWeight: 'bold' }}>{telemetry.activeProtection}</span>
              </div>
              <div style={{ backgroundColor: '#161622', padding: '4px', borderRadius: '4px', border: '1px solid #222330' }}>
                <span style={{ color: '#a6adc8', display: 'block' }}>📋 ავარიის ტიპი:</span>
                <span style={{ color: '#cdd6f4', fontWeight: 'bold' }}>{telemetry.faultTypeVal}</span>
              </div>
              <div style={{ backgroundColor: '#161622', padding: '4px', borderRadius: '4px', border: '1px solid #222330' }}>
                <span style={{ color: '#a6adc8', display: 'block' }}>💥 ავარიის დენი ($I_f$):</span>
                <span style={{ color: '#f38ba8', fontWeight: 'bold' }}>{telemetry.faultCurrentVal}</span>
              </div>
              <div style={{ backgroundColor: '#161622', padding: '4px', borderRadius: '4px', border: '1px solid #222330' }}>
                <span style={{ color: '#a6adc8', display: 'block' }}>📉 ავარიული ძაბვა:</span>
                <span style={{ color: '#f9e2af', fontWeight: 'bold' }}>{telemetry.faultVoltageVal}</span>
              </div>
              <div style={{ backgroundColor: '#161622', padding: '4px', borderRadius: '4px', border: '1px solid #222330' }}>
                <span style={{ color: '#a6adc8', display: 'block' }}>⏱️ გამორთვის დრო:</span>
                <span style={{ color: '#a6e3a1', fontWeight: 'bold' }}>{telemetry.tripTimeVal}</span>
              </div>
              <div style={{ backgroundColor: '#161622', padding: '4px', borderRadius: '4px', border: '1px solid #222330' }}>
                <span style={{ color: '#a6adc8', display: 'block' }}>📍 ავარიის მანძილი:</span>
                <span style={{ color: '#89b4fa', fontWeight: 'bold' }}>{telemetry.faultDistanceVal}</span>
              </div>
              <div style={{ backgroundColor: '#161622', padding: '4px', borderRadius: '4px', border: '1px solid #222330' }}>
                <span style={{ color: '#a6adc8', display: 'block' }}>🌀 ნულოვანი დენი ($I_0$):</span>
                <span style={{ color: '#cdd6f4', fontWeight: 'bold' }}>{telemetry.zeroSeqVal}</span>
              </div>
              <div style={{ backgroundColor: '#161622', padding: '4px', borderRadius: '4px', border: '1px solid #222330' }}>
                <span style={{ color: '#a6adc8', display: 'block' }}>📁 COMTRADE ჩანაწერი:</span>
                <span style={{ color: '#b4befe', fontWeight: 'bold' }}>{telemetry.comtradeVal}</span>
              </div>
            </div>
          </div>

          {/* Event Log */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#07070a', borderRadius: '4px', padding: '8px', border: '1px solid #222330', minHeight: '180px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, fontSize: '11px', color: '#89b4fa', fontWeight: 'bold' }}>
                📜 მოვლენათა ჟურნალი
              </h3>
              <button style={{ backgroundColor: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '11px' }} onClick={clearLogs}>🗑️</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: '9px' }}>
              {logs.map((log, index) => (
                <div key={index} style={{ marginBottom: '3px', lineHeight: '1.3', color: log.type === 'success' ? '#a6e3a1' : log.type === 'warn' ? '#f9e2af' : log.type === 'danger' ? '#f38ba8' : '#cdd6f4' }}>
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