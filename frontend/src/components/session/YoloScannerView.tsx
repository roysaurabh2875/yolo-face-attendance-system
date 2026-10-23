import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAttendance } from '../../context/AttendanceContext';
import { Student } from '../../types/attendance';
import { api } from '../../services/api';
import { 
  ScanFace, 
  Play, 
  Pause, 
  CheckCircle2, 
  Lock, 
  Camera, 
  Video, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  UserCheck, 
  Users, 
  Eye, 
  History,
  Sparkles,
  Info,
  Laptop,
  Smartphone,
  Download,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface YoloScannerViewProps {
  onOpenDetails: (studentId: string) => void;
  onOpenCorrectionModal: (student: Student, action: 'mark_present' | 'mark_absent') => void;
}

export const YoloScannerView: React.FC<YoloScannerViewProps> = ({
  onOpenDetails,
  onOpenCorrectionModal
}) => {
  const {
    currentSession,
    sessionStatus,
    startSession,
    endSession,
    finalizeSession,
    submitAndResetAttendance,
    students,
    presentRecords,
    absentRecords,
    selectedClassId,
    selectedSubjectCode,
    selectedDate,
    refreshData,
    backendConnected,
    recentSessions,
    loadRecentSessions,
    addToast
  } = useAttendance();

  // Historical / Recent Sessions State
  const [expandedSessionId, setExpandedSessionId] = useState<number | string | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<Record<string, any[]>>({});
  const [loadingRecords, setLoadingRecords] = useState<Record<string, boolean>>({});
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false);

  const handleRefreshSessions = async () => {
    setIsRefreshingSessions(true);
    await loadRecentSessions();
    setTimeout(() => setIsRefreshingSessions(false), 500);
  };

  const handleToggleExpandSession = async (session: any) => {
    const rawId = session.session_id || session.id;
    if (expandedSessionId === rawId) {
      setExpandedSessionId(null);
      return;
    }
    setExpandedSessionId(rawId);
    if (!expandedRecords[rawId]) {
      setLoadingRecords(prev => ({ ...prev, [rawId]: true }));
      try {
        const sessionIdNum = session.session_id || parseInt(String(session.id).replace(/\D/g, ''), 10);
        const res = await api.getPostedSessionRecords(sessionIdNum);
        if (res && Array.isArray(res.records)) {
          setExpandedRecords(prev => ({ ...prev, [rawId]: res.records }));
        }
      } catch (err) {
        console.warn('Failed to load session records:', err);
      } finally {
        setLoadingRecords(prev => ({ ...prev, [rawId]: false }));
      }
    }
  };

  const handleDownloadSessionCsv = async (e: React.MouseEvent, session: any) => {
    e.stopPropagation();
    try {
      const sessionIdNum = session.session_id || parseInt(String(session.id).replace(/\D/g, ''), 10);
      const res = await api.getPostedSessionRecords(sessionIdNum);
      const recordsToExport = res?.records && Array.isArray(res.records) ? res.records : [];
      
      const csvRows = [
        ["CollegeVision Attendance - Official Session Record"],
        [`Session ID: ${session.id || ('SES-' + String(session.session_id).padStart(3, '0'))}`],
        [`Subject: ${session.subject_code || 'CP301'} - ${session.subject_name || 'Competitive Programming'}`],
        [`Class: ${session.class_name || 'III SU-1'} | Section: ${session.section || 'SU-1'}`],
        [`Date: ${session.date} | Period: ${session.period_number || 1}`],
        [`Total Students: ${session.total_students || 110} | Present: ${session.present_count || 0} | Absent: ${session.absent_count || 0}`],
        [],
        ["Roll Number", "Student Name", "Status", "Detection Source", "Time Logged"]
      ];

      recordsToExport.forEach((r: any) => {
        csvRows.push([
          r.roll_number,
          `"${r.student_name}"`,
          r.status.toUpperCase(),
          r.source || 'SYSTEM',
          r.timestamp || '-'
        ]);
      });

      const csvContent = csvRows.map(row => Array.isArray(row) ? row.join(',') : row).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Attendance_${session.id || 'SES-' + session.session_id}_${session.subject_code || 'CP301'}_${session.date}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      addToast('success', 'CSV Exported', `Session ${session.id || sessionIdNum} attendance register CSV downloaded.`);
    } catch (err) {
      addToast('error', 'Download Failed', 'Could not fetch session records for download.');
    }
  };

  // WebCam state
  const [useWebcam, setUseWebcam] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Camera device management (Prioritizing Laptop Webcam over Phone Cameras)
  const [videoDevices, setVideoDevices] = useState<Array<{
    deviceId: string;
    label: string;
    isLaptop: boolean;
  }>>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  const [activeDetections, setActiveDetections] = useState<Array<{
    id: string;
    student_id?: string;
    name?: string;
    roll_number?: string;
    label: string;
    confidence: string;
    attendance_state?: 'marked_now' | 'already_marked';
    x: number;
    y: number;
    w: number;
    h: number;
    status: 'recognized' | 'low_confidence' | 'unrecognized';
  }>>([]);

  // Live on-screen attendance feedback alert (Marked vs Already Marked)
  const [recognitionAlert, setRecognitionAlert] = useState<{
    type: 'marked_now' | 'already_marked';
    name: string;
    rollNumber: string;
    timestamp: string;
  } | null>(null);

  // Auto-dismiss the on-screen alert banner after 4.5 seconds
  useEffect(() => {
    if (!recognitionAlert) return;
    const timer = setTimeout(() => {
      setRecognitionAlert(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [recognitionAlert]);

  const [unrecognizedFaces, setUnrecognizedFaces] = useState<Array<{
    id: string;
    time: string;
    frameSnapshot: string;
    reason: string;
  }>>([]);

  // Discover and classify video devices (prioritizing built-in laptop camera)
  const enumerateCameras = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');

      const classified = videoInputs.map((d, index) => {
        const rawLabel = d.label || `Camera ${index + 1}`;
        const lower = rawLabel.toLowerCase();

        const isPhoneOrVirtual =
          lower.includes('phone') ||
          lower.includes('droidcam') ||
          lower.includes('iriun') ||
          lower.includes('camo') ||
          lower.includes('virtual') ||
          lower.includes('continuity') ||
          lower.includes('link to windows') ||
          lower.includes('epoccam') ||
          lower.includes('obs');

        const isLaptop =
          lower.includes('integrated') ||
          lower.includes('internal') ||
          lower.includes('laptop') ||
          lower.includes('builtin') ||
          lower.includes('front') ||
          lower.includes('hd webcam') ||
          lower.includes('webcam') ||
          !isPhoneOrVirtual;

        const displayName = isLaptop && !isPhoneOrVirtual
          ? `💻 ${rawLabel || 'Laptop Webcam'}`
          : isPhoneOrVirtual
          ? `📱 ${rawLabel || 'Phone / Virtual'}`
          : `📷 ${rawLabel}`;

        return {
          deviceId: d.deviceId,
          label: displayName,
          isLaptop: isLaptop && !isPhoneOrVirtual
        };
      });

      // Sort so laptop webcams are prioritized first
      classified.sort((a, b) => (b.isLaptop ? 1 : 0) - (a.isLaptop ? 1 : 0));
      setVideoDevices(classified);

      // Auto-select laptop camera if not currently selected
      if (classified.length > 0) {
        setSelectedDeviceId((current) => {
          if (current && classified.some((c) => c.deviceId === current)) {
            return current;
          }
          const best = classified.find((c) => c.isLaptop) || classified[0];
          return best.deviceId;
        });
      }
    } catch (err) {
      console.warn('Camera enumeration error:', err);
    }
  }, []);

  // Enumerate cameras on component mount
  useEffect(() => {
    enumerateCameras();
  }, [enumerateCameras]);

  // Handle webcam stream start/stop and device switching
  useEffect(() => {
    let stream: MediaStream | null = null;
    if (useWebcam) {
      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { width: { ideal: 640 }, height: { ideal: 480 } }
      };

      navigator.mediaDevices?.getUserMedia(constraints)
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play().catch(() => {});
          }
          setWebcamError(null);
          // Re-enumerate to get full device labels after permission is granted
          enumerateCameras();
        })
        .catch((err) => {
          console.warn('Specific device constraint failed, trying generic constraints:', err);
          navigator.mediaDevices?.getUserMedia({ video: { width: 640, height: 480 } })
            .then((s) => {
              stream = s;
              if (videoRef.current) {
                videoRef.current.srcObject = s;
                videoRef.current.play().catch(() => {});
              }
              setWebcamError(null);
              enumerateCameras();
            })
            .catch(() => {
              setWebcamError('Camera access not permitted or unavailable. Displaying AI Vision Canvas.');
              setUseWebcam(false);
            });
        });
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [useWebcam, selectedDeviceId, enumerateCameras]);

  // Live YOLO face detection from webcam feed to FastAPI backend
  useEffect(() => {
    if (!useWebcam || sessionStatus !== 'in_progress') return;

    let isScanning = false;
    const interval = setInterval(async () => {
      if (isScanning || !videoRef.current || videoRef.current.readyState < 2) return;
      isScanning = true;

      try {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);

          const result = await api.detectFrame(dataUrl, currentSession.id);
          if (result && Array.isArray(result.detections) && result.detections.length > 0) {
            const mapped = result.detections.map((d: any) => {
              // Check if locally recorded in presentRecords or reported as already_marked from backend
              const isLocallyPresent = presentRecords.some(
                (r) => r.studentId === d.student_id || (d.roll_number && r.rollNumber === d.roll_number)
              );
              const state: 'marked_now' | 'already_marked' =
                d.attendance_state === 'already_marked' || isLocallyPresent
                  ? 'already_marked'
                  : 'marked_now';

              return {
                id: d.id,
                student_id: d.student_id,
                name: d.name,
                roll_number: d.roll_number,
                label: d.label,
                confidence: d.confidence,
                attendance_state: state,
                x: d.x,
                y: d.y,
                w: d.w,
                h: d.h,
                status: d.status
              };
            });

            setActiveDetections(mapped);

            // Trigger immediate on-screen marked / already marked alert
            const recognized = mapped.find((d: any) => d.status === 'recognized' && d.name);
            if (recognized) {
              setRecognitionAlert({
                type: recognized.attendance_state || 'marked_now',
                name: recognized.name || recognized.label,
                rollNumber: recognized.roll_number || '',
                timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
              });

              if (recognized.attendance_state === 'marked_now') {
                refreshData();
              }
            }
          }
        }
      } catch (err) {
        // Continue silently on transient frame error
      } finally {
        isScanning = false;
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [useWebcam, sessionStatus, currentSession.id, presentRecords, refreshData]);

  const handleIdentifyUnrecognized = () => {
    if (absentRecords.length > 0) {
      const student = students.find((s) => s.id === absentRecords[0].studentId);
      if (student) {
        onOpenCorrectionModal(student, 'mark_present');
        setUnrecognizedFaces((prev) => prev.slice(1));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Session Controller Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                YOLOv8 Attendance Camera Stream & Session Controller
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                AI computer vision attendance scanner for {selectedClassId} · {selectedSubjectCode}
              </p>
            </div>
          </div>
        </div>

        {/* Session Status & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {sessionStatus === 'scheduled' && (
            <button
              onClick={startSession}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Attendance Session</span>
            </button>
          )}

          {sessionStatus === 'in_progress' && (
            <>
              <button
                onClick={endSession}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Session</span>
              </button>

              <button
                onClick={finalizeSession}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Close & Finalize Session</span>
              </button>
            </>
          )}

          {sessionStatus === 'finalized' && (
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-lg shadow-2xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Session Sealed & Archived</span>
              </span>
              <button
                onClick={submitAndResetAttendance}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Next Attendance Session</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Camera Viewfinder (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-lg flex flex-col">
          {/* Top Camera HUD bar */}
          <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${sessionStatus === 'in_progress' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                <span className="font-mono uppercase font-bold text-[11px]">
                  {sessionStatus === 'in_progress' ? 'STREAM: LIVE_AI_SCAN' : 'STREAM: IDLE / PAUSED'}
                </span>
              </span>
              <span className="text-slate-600 hidden sm:inline">|</span>
              <span className="font-mono text-[11px] text-slate-400 hidden md:inline">
                YOLOv8-Face · 640x480 @ 30 FPS
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              {/* Camera Source Selector */}
              {videoDevices.length > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs">
                  <Laptop className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="bg-transparent text-slate-200 text-xs focus:outline-hidden cursor-pointer max-w-[190px] truncate"
                    title="Select Camera Input (Pick Laptop Webcam to avoid phone camera)"
                  >
                    {videoDevices.map((dev) => (
                      <option key={dev.deviceId} value={dev.deviceId} className="bg-slate-900 text-white">
                        {dev.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Quick Laptop Cam Switch button if phone was selected */}
              {videoDevices.some((d) => d.isLaptop && d.deviceId !== selectedDeviceId) && (
                <button
                  type="button"
                  onClick={() => {
                    const laptopCam = videoDevices.find((d) => d.isLaptop);
                    if (laptopCam) setSelectedDeviceId(laptopCam.deviceId);
                  }}
                  className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[11px] font-medium transition-colors"
                  title="Force switch to built-in laptop camera"
                >
                  Use Laptop Cam
                </button>
              )}

              <button
                onClick={() => setUseWebcam(!useWebcam)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs ${
                  useWebcam ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{useWebcam ? 'Webcam Active' : 'Start Laptop Cam'}</span>
              </button>
            </div>
          </div>

          {/* Viewfinder Display */}
          <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden">
            {useWebcam ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              /* Simulated Hall Feed */
              <div 
                className="relative w-full h-full bg-cover bg-center"
                style={{
                  backgroundImage: `url('https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1200&auto=format&fit=crop&q=80')`
                }}
              >
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[0.5px]" />
              </div>
            )}

            {/* Live On-Screen Attendance Feedback Banner (Marked vs Already Marked) */}
            {recognitionAlert && (
              <div
                className={`absolute top-4 inset-x-4 mx-auto max-w-md p-4 rounded-xl shadow-2xl border-2 flex items-center gap-3.5 z-40 transition-all duration-300 ${
                  recognitionAlert.type === 'marked_now'
                    ? 'bg-emerald-600/95 text-white border-emerald-300 shadow-emerald-950/40'
                    : 'bg-amber-600/95 text-white border-amber-300 shadow-amber-950/40'
                }`}
              >
                <div
                  className={`p-2.5 rounded-lg shrink-0 ${
                    recognitionAlert.type === 'marked_now' ? 'bg-emerald-700' : 'bg-amber-700'
                  }`}
                >
                  {recognitionAlert.type === 'marked_now' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-100" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-100" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded shadow-xs ${
                        recognitionAlert.type === 'marked_now'
                          ? 'bg-emerald-800 text-emerald-100'
                          : 'bg-amber-800 text-amber-100'
                      }`}
                    >
                      {recognitionAlert.type === 'marked_now' ? '✓ ATTENDANCE MARKED' : '⚠️ ALREADY MARKED'}
                    </span>
                    <span className="text-[11px] font-mono opacity-80">{recognitionAlert.timestamp}</span>
                  </div>
                  <p className="font-extrabold text-sm text-white mt-1 truncate">
                    {recognitionAlert.name} ({recognitionAlert.rollNumber})
                  </p>
                  <p className="text-xs opacity-90 mt-0.5">
                    {recognitionAlert.type === 'marked_now'
                      ? 'Attendance successfully recorded in MySQL.'
                      : 'Attendance already recorded for this student in this session.'}
                  </p>
                </div>
              </div>
            )}

            {/* Scanning HUD Overlay Grid */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Scanline Animation */}
              {sessionStatus === 'in_progress' && (
                <div className="absolute inset-x-0 h-0.5 bg-blue-500/80 shadow-[0_0_12px_#3b82f6] animate-[bounce_3s_infinite]" />
              )}

              {/* Viewfinder Crosshairs */}
              <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue-400" />
              <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue-400" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue-400" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue-400" />

              {/* Target Bounding Boxes with Marked / Already Marked labels */}
              {sessionStatus === 'in_progress' && activeDetections.map((det) => {
                const isAlready = det.attendance_state === 'already_marked';
                const isMarked = det.attendance_state === 'marked_now';

                return (
                  <div
                    key={det.id}
                    className={`absolute border-2 rounded-sm transition-all duration-300 ${
                      isAlready
                        ? 'border-amber-400 bg-amber-500/15'
                        : isMarked
                        ? 'border-emerald-400 bg-emerald-500/15 animate-pulse'
                        : 'border-blue-400 bg-blue-500/10'
                    }`}
                    style={{
                      left: `${det.x}%`,
                      top: `${det.y}%`,
                      width: `${det.w}%`,
                      height: `${det.h}%`
                    }}
                  >
                    <div
                      className={`absolute -top-7 left-0 text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded shadow-md whitespace-nowrap flex items-center gap-1.5 border ${
                        isAlready
                          ? 'bg-amber-600 border-amber-300'
                          : isMarked
                          ? 'bg-emerald-600 border-emerald-300'
                          : 'bg-slate-800 border-slate-600'
                      }`}
                    >
                      {isAlready ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-200" />
                          <span>Already Marked: {det.name || det.label}</span>
                          <span className="text-amber-200 font-normal">({det.confidence})</span>
                        </>
                      ) : isMarked ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                          <span>✓ Marked: {det.name || det.label}</span>
                          <span className="text-emerald-200 font-normal">({det.confidence})</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-blue-300" />
                          <span>{det.label}</span>
                          <span className="text-blue-200 font-normal">({det.confidence})</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Offline/Paused watermark when paused */}
            {sessionStatus !== 'in_progress' && (
              <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-center p-6">
                <ScanFace className="w-12 h-12 text-slate-500 mb-3" />
                <p className="text-sm font-bold text-white">YOLO Vision Scanner Inactive</p>
                <p className="text-xs text-slate-400 max-w-sm mt-1">
                  Click "Start Attendance Session" above to activate classroom camera feed and automated face recognition.
                </p>
                {sessionStatus === 'scheduled' && (
                  <button
                    onClick={startSession}
                    className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                  >
                    Activate Scanner
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Scanner Controls Toolbar */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="font-mono">
                Present: <span className="text-emerald-400 font-bold">{presentRecords.length}</span>
              </span>
              <span>·</span>
              <span className="font-mono">
                Absent: <span className="text-rose-400 font-bold">{absentRecords.length}</span>
              </span>
              <span>·</span>
              <span className="font-mono">
                Rate: <span className="text-white font-bold">{((presentRecords.length / students.length) * 100).toFixed(1)}%</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live YOLO Face Recognition Active</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Unrecognized Faces Queue & Live Detection Log (1 col) */}
        <div className="space-y-4">
          {/* Unrecognized / Low Confidence Alert Box */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-amber-50/70 border-b border-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                  Unrecognized Faces ({unrecognizedFaces.length})
                </h3>
              </div>
              <span className="text-[10px] font-mono text-amber-700">Needs Review</span>
            </div>

            <div className="p-4">
              {unrecognizedFaces.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-500">
                  No unrecognized faces pending review.
                </div>
              ) : (
                <div className="space-y-3">
                  {unrecognizedFaces.map((f) => (
                    <div key={f.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={f.frameSnapshot}
                          alt="Captured face crop"
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-lg object-cover ring-1 ring-slate-300"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">Unknown Student Entry</p>
                          <p className="text-[11px] font-mono text-slate-500">{f.time}</p>
                          <p className="text-[10px] text-amber-700 mt-0.5">{f.reason}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                        <button
                          onClick={handleIdentifyUnrecognized}
                          className="flex-1 py-1 px-2 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors text-center"
                        >
                          Identify & Mark Present
                        </button>
                        <button
                          onClick={() => setUnrecognizedFaces((prev) => prev.filter((item) => item.id !== f.id))}
                          className="py-1 px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-200 rounded transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Roster Breakdown */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Current Session Summary
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Session ID:</span>
                <span className="font-mono text-slate-800">{currentSession.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Class Room:</span>
                <span className="font-semibold text-slate-800">{currentSession.room}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Instructor:</span>
                <span className="font-semibold text-slate-800">{currentSession.teacherName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Face Recognition Method:</span>
                <span className="font-semibold text-emerald-700">YOLOv8 Dual-Stage</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Verification Threshold:</span>
                <span className="font-mono text-slate-800">&ge; 85.0% Cosine Match</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Sessions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <History className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Attendance Session Logs
                </h3>
                {recentSessions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {recentSessions.length} {recentSessions.length === 1 ? 'Session' : 'Sessions'} Recorded
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Archived & sealed class attendance sessions stored permanently in SQL
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Permanent Academic Record</span>
            <button
              type="button"
              onClick={handleRefreshSessions}
              disabled={isRefreshingSessions}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh session logs from server"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshingSessions ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Session ID</th>
                <th className="py-2.5 px-4">Date & Time</th>
                <th className="py-2.5 px-4">Subject</th>
                <th className="py-2.5 px-4">Class</th>
                <th className="py-2.5 px-4">Present / Total</th>
                <th className="py-2.5 px-4">Attendance Rate</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 bg-slate-50/30">
                    <div className="flex flex-col items-center justify-center space-y-2 max-w-sm mx-auto">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                        <History className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">No Finalized Sessions Recorded Yet</p>
                      <p className="text-xs text-slate-500 text-center leading-relaxed">
                        Start an attendance scan with the camera, then click <strong>"Close & Finalize Session"</strong> above. Sealed session records will be permanently archived here.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                recentSessions.map((ses: any) => {
                  const rawId = ses.session_id || ses.id;
                  const isExpanded = expandedSessionId === rawId;
                  const total = ses.total_students ?? ses.totalStudents ?? 110;
                  const present = ses.present_count ?? ses.presentCount ?? 0;
                  const pct = ses.attendance_rate !== undefined 
                    ? Number(ses.attendance_rate).toFixed(1)
                    : (total > 0 ? ((present / total) * 100).toFixed(1) : '0.0');
                  const sessionId = ses.id || (ses.session_id ? `SES-${String(ses.session_id).padStart(3, '0')}` : 'SES-???');
                  const dateStr = ses.date || '-';
                  const timeStr = ses.time_slot || ses.timeSlot || '09:30 AM - 12:15 PM';
                  const subjCode = ses.subject_code || ses.subjectCode || 'CP301';
                  const subjName = ses.subject_name || ses.subjectName || 'Competitive Programming';
                  const cls = ses.class_name || ses.className || 'III SU-1';
                  const status = ses.status || 'FINALIZED';
                  const records = expandedRecords[rawId];
                  const isLoadingRoster = loadingRecords[rawId];

                  return (
                    <React.Fragment key={rawId}>
                      <tr 
                        onClick={() => handleToggleExpandSession(ses)}
                        className={`cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/40' : 'hover:bg-slate-50/80'}`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-blue-700 flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>{sessionId}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono">
                          <span className="font-semibold text-slate-800">{dateStr}</span>
                          <span className="block text-slate-400 text-[11px] font-sans">({timeStr})</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-900 block">{subjCode}</span>
                          <span className="text-[11px] text-slate-500 font-normal">{subjName}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{cls}</td>
                        <td className="py-3 px-4 font-mono">
                          <span className="text-emerald-700 font-bold text-sm">{present}</span>
                          <span className="text-slate-400"> / {total}</span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            Number(pct) >= 75 
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {pct}%
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            {status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => handleDownloadSessionCsv(e, ses)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md shadow-2xs transition-colors"
                              title="Download official session CSV register"
                            >
                              <Download className="w-3 h-3 text-slate-600" />
                              <span>CSV</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleExpandSession(ses)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{isExpanded ? 'Hide' : 'View'}</span>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Session Roster Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={8} className="p-4 border-t border-b border-blue-100">
                            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-3 shadow-xs">
                              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-2">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-900">
                                    Official Roster Records for Session {sessionId}
                                  </h4>
                                  <p className="text-[11px] text-slate-500">
                                    {subjCode} — {subjName} | Date: {dateStr} | Period: {ses.period_number || 1}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    Present: {present}
                                  </span>
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                                    Absent: {total - present}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDownloadSessionCsv(e, ses)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors ml-2"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Export Register CSV</span>
                                  </button>
                                </div>
                              </div>

                              {isLoadingRoster ? (
                                <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                                  <span>Loading attendance roster from database...</span>
                                </div>
                              ) : records && records.length > 0 ? (
                                <div className="max-h-60 overflow-y-auto rounded border border-slate-100">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-600 sticky top-0">
                                      <tr>
                                        <th className="py-2 px-3">Roll No</th>
                                        <th className="py-2 px-3">Student Name</th>
                                        <th className="py-2 px-3">Status</th>
                                        <th className="py-2 px-3">Method</th>
                                        <th className="py-2 px-3">Time</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {records.map((r: any, rIdx: number) => {
                                        const isPresent = r.status?.toLowerCase() === 'present';
                                        return (
                                          <tr key={r.student_id || r.roll_number || rIdx} className="hover:bg-slate-50">
                                            <td className="py-1.5 px-3 font-mono font-semibold text-slate-800">
                                              {r.roll_number || r.student_id}
                                            </td>
                                            <td className="py-1.5 px-3 font-medium text-slate-900">
                                              {r.student_name || 'Student'}
                                            </td>
                                            <td className="py-1.5 px-3">
                                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                isPresent 
                                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                                  : 'bg-rose-50 text-rose-800 border border-rose-200'
                                              }`}>
                                                {isPresent ? <UserCheck className="w-3 h-3 text-emerald-600" /> : null}
                                                {r.status?.toUpperCase() || (isPresent ? 'PRESENT' : 'ABSENT')}
                                              </span>
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-500 font-mono text-[10px]">
                                              {r.source || (isPresent ? 'FACE' : 'SYSTEM')}
                                            </td>
                                            <td className="py-1.5 px-3 text-slate-400 font-mono text-[10px]">
                                              {r.timestamp || '-'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 italic py-2">
                                  No individual student audit records available for this session.
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
