import { apiFetch } from '../lib/apiFetch.mjs';
import { useState, useRef, useContext, useEffect } from 'react';
import { FARM_HARVEST_REFERENCE, maturityAdvice, maturityReadiness } from '../lib/maturityAdvice.mjs';
import ScanSaveStatus from './ScanSaveStatus';
import PredictionTransactions from './PredictionTransactions';
import HarvestRecords from './HarvestRecords';
import { LanguageContext } from '../LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Progress } from './ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import {
  Upload,
  Camera,
  Apple,
  CheckCircle2,
  Loader2,
  Info,
  FileImage,
  Clock,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function MaturityDetection({ onAnalysisComplete }) {
  const { language } = useContext(LanguageContext);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  const translations = {
    en: {
      title: 'AI-Powered Maturity Detection',
      analyze: 'Analyze',
      upload: 'Upload Image',
      camera: 'Use Camera',
      result: 'Result',
      unripe: 'Unripe',
      nearlyRipe: 'Nearly Ripe',
      ripe: 'Ripe',
      overripe: 'Overripe',
      confidence: 'Confidence',
      daysToHarvest: 'Days to Harvest',
      qualityGrade: 'Quality Grade',
      harvestingTips: 'Harvesting Tips',
      storageAdvice: 'Storage Advice',
      close: 'Close',
      capture: 'Capture',
      captureUploadTitle: 'Capture or Upload Fruit Image', captureUploadDesc: 'Take a photo or upload a clear image of the rambutan fruit', capturePrompt: 'Capture a photo or upload an image', supported: 'Supports JPG, PNG, and WebP formats', takePhoto: 'Take Photo', uploadImage: 'Upload Image', analyzeMaturity: 'Analyze Maturity', clear: 'Clear', analyzingMaturity: 'Analyzing maturity...', step: 'Step 1/3', analyzingDesc: 'AI model is analyzing fruit color, size, and ripeness indicators', analysisTitle: 'Maturity Analysis', analysisDesc: 'AI-generated assessment and harvest recommendations', noResults: 'No results yet', uploadToResults: 'Upload and analyze a fruit image to see results', confident: 'confident', confidenceNA: 'Confidence: N/A', daysHarvest: 'Days to Harvest', confidenceLevel: 'Confidence Level', observed: 'Observed Characteristics:', nlpTitle: 'NLP Recommendation', noRecommendation: 'No natural-language recommendation available yet.',       harvesting: 'Harvesting Recommendations', harvestingDesc: 'Best practices for optimal harvest timing and handling', harvestReadiness: 'Harvest readiness', harvestReference: 'Farm harvest reference', harvestReadinessDesc: 'Use the farm season as context; each maturity scan assesses only the photographed fruit.', harvestSeason: 'Expected harvest season', floweringPeriod: 'Flowering period', reportedCycle: 'Reported harvesting cycle', cycleValue: `About ${FARM_HARVEST_REFERENCE.reportedCycleMonths} months`, cycleCaution: 'The 8-month cycle is not used to calculate future dates until its relationship with the annual harvest season is confirmed.', ripeHarvestGuidance: 'This image suggests one fruit may be ripe. Inspect its actual condition and consider harvesting only if suitable; this does not mean the whole farm is ready.', unripeHarvestGuidance: 'Keep monitoring this fruit on the tree. Harvest season alone does not mean the fruit is ready.', noHarvestAssessment: 'No confirmed fruit assessment yet. A single image cannot determine readiness for the whole farm.', critical: 'Harvest Timing is Critical', criticalDesc: 'Rambutans do not ripen well after harvest. Only pick fruit that has reached proper maturity on the tree.', guidelines: 'Harvesting Guidelines:', storage: 'Storage & Handling:', tipsTitle: 'Tips for Best Results', naturalLight: 'Natural Light', naturalLightDesc: 'Take photos in daylight to accurately capture fruit color', multipleAngles: 'Multiple Angles', multipleAnglesDesc: 'Capture different fruits to assess overall crop maturity', dailyMonitoring: 'Daily Monitoring', dailyMonitoringDesc: 'Check maturity daily during harvest season', captureTitle: 'Capture Fruit Photo', captureDesc: 'Position the rambutan fruit clearly in the frame and tap capture', retry: 'Try Again with Different Image', ai: 'AI', fallback: 'Fallback', na: 'N/A', resultLabels: { unripe: 'Unripe - Too Early', 'nearly-ripe': 'Nearly Ripe - Almost Ready', ready: 'Ripe - Ready to Harvest', overripe: 'Overripe - Harvest Urgently' }, resultDescriptions: { unripe: 'Rambutan is not ready for harvest yet.', 'nearly-ripe': 'Rambutan is approaching maturity. Harvest within 3-5 days.', ready: 'Perfect maturity. Harvest now for the best quality.', overripe: 'The fruit is past peak maturity. Harvest immediately.' },
    },
    tl: {
      title: 'AI-Powered Pagkilala ng Hinog',
      analyze: 'Suriin',
      upload: 'Mag-upload ng Larawan',
      camera: 'Gamitin ang Kamera',
      result: 'Resulta',
      unripe: 'Hindi Pa Hinog',
      nearlyRipe: 'Malapit Nang Hinog',
      ripe: 'Hinog',
      overripe: 'Sobrang Hinog',
      confidence: 'Kumpiyansa',
      daysToHarvest: 'Araw Bago Anihin',
      qualityGrade: 'Kalidad',
      harvestingTips: 'Mga Tip sa Pag-ani',
      storageAdvice: 'Payo sa Pag-iimbak',
      close: 'Isara',
      capture: 'Kunan',
      captureUploadTitle: 'Kuhanan o I-upload ang Larawan ng Rambutan', captureUploadDesc: 'Kuhanan o mag-upload ng malinaw na larawan ng rambutan', capturePrompt: 'Kuhanan ng larawan o mag-upload ng image', supported: 'Tumatanggap ng JPG, PNG, at WebP', takePhoto: 'Kuhanan ng Larawan', uploadImage: 'Mag-upload ng Larawan', analyzeMaturity: 'Suriin ang Pagkahinog', clear: 'I-clear', analyzingMaturity: 'Sinusuri ang pagkahinog...', step: 'Hakbang 1/3', analyzingDesc: 'Sinusuri ng AI ang kulay, laki, at mga palatandaan ng pagkahinog', analysisTitle: 'Pagsusuri ng Pagkahinog', analysisDesc: 'Pagsusuri ng AI at mga payo sa pag-ani', noResults: 'Wala pang resulta', uploadToResults: 'Mag-upload at magsuri ng larawan ng rambutan para makita ang resulta', confident: 'kumpiyansa', confidenceNA: 'Kumpiyansa: Wala', daysHarvest: 'Araw Bago Anihin', confidenceLevel: 'Antas ng Kumpiyansa', observed: 'Mga Nakikitang Katangian:', nlpTitle: 'Rekomendasyon', noRecommendation: 'Wala pang natural-language na rekomendasyon.',       harvesting: 'Mga Rekomendasyon sa Pag-ani', harvestingDesc: 'Mga tamang paraan para sa oras at paghawak ng ani', harvestReadiness: 'Kahandaan sa pag-ani', harvestReference: 'Sanggunian sa panahon ng ani', harvestReadinessDesc: 'Gamitin ang panahon ng ani bilang gabay; isang larawang prutas lamang ang sinusuri sa bawat assessment.', harvestSeason: 'Inaasahang panahon ng ani', floweringPeriod: 'Panahon ng pamumulaklak', reportedCycle: 'Iniulat na cycle ng pag-aani', cycleValue: `Humigit-kumulang ${FARM_HARVEST_REFERENCE.reportedCycleMonths} buwan`, cycleCaution: 'Hindi ginagamit ang 8-buwang cycle sa pagkalkula ng petsa hangga’t hindi napapatunayan ang kaugnayan nito sa taunang panahon ng ani.', ripeHarvestGuidance: 'Maaaring hinog ang isang bunga batay sa larawang ito. Suriin muna ang aktuwal na kondisyon at anihin lamang kung angkop; hindi ibig sabihin nito na handa nang anihin ang buong bukid.', unripeHarvestGuidance: 'Patuloy na bantayan ang bungang ito habang nasa puno. Hindi nangangahulugang handa nang anihin ang bunga dahil panahon na ng anihan.', noHarvestAssessment: 'Wala pang kumpirmadong pagsusuri ng bunga. Hindi matutukoy sa iisang larawan kung handa nang anihin ang buong bukid.', critical: 'Mahalaga ang Tamang Oras ng Pag-ani', criticalDesc: 'Hindi gaanong nahihinog ang rambutan pagkatapos anihin. Pitasin lamang ang sapat na hinog sa puno.', guidelines: 'Mga Gabay sa Pag-ani:', storage: 'Pag-iimbak at Paghawak:', tipsTitle: 'Mga Tip para sa Mas Magandang Resulta', naturalLight: 'Natural na Ilaw', naturalLightDesc: 'Kuhanan sa liwanag ng araw para makita nang tama ang kulay', multipleAngles: 'Iba’t Ibang Anggulo', multipleAnglesDesc: 'Kuhanan ang iba’t ibang bunga para masuri ang kabuuang ani', dailyMonitoring: 'Araw-araw na Pagsusuri', dailyMonitoringDesc: 'Suriin ang pagkahinog araw-araw sa panahon ng anihan', captureTitle: 'Kuhanan ng Larawan ng Rambutan', captureDesc: 'Iposisyon nang malinaw ang rambutan at pindutin ang capture', retry: 'Subukan Gamit ang Ibang Larawan', ai: 'AI', fallback: 'Fallback', na: 'Wala', resultLabels: { unripe: 'Hindi Pa Hinog - Masyado Pang Maaga', 'nearly-ripe': 'Malapit Nang Hinog - Halos Handa Na', ready: 'Hinog - Handa Nang Anihin', overripe: 'Sobrang Hinog - Agarang Anihin' }, resultDescriptions: { unripe: 'Hindi pa handang anihin ang rambutan.', 'nearly-ripe': 'Malapit nang mahinog ang rambutan. Anihin sa loob ng 3-5 araw.', ready: 'Tamang pagkahinog. Anihin ngayon para sa pinakamahusay na kalidad.', overripe: 'Lampas na sa pinakamainam na pagkahinog ang bunga. Anihin agad.' },
    },
  };
  const maturityFlowText = {
    en: {
      title: 'CNN Fruit Maturity Assessment',
      analysisDesc: 'Existing CNN classification and guidance for the photographed fruit.',
      confidenceNA: 'Confidence unavailable',
      assessmentImageAlt: 'Fruit image used for this maturity assessment',
      recommendationSource: 'Guidance based on the CNN classification',
      recommendationDisclaimer: 'General monitoring guidance only. A ripe result applies to this photographed fruit, not the whole tree or farm.',
      resultLabels: {
        immature: 'Unripe',
        mature: 'Ripe',
      },
      resultDescriptions: {
        immature: 'The existing CNN classified the photographed fruit as unripe. Continue monitoring it on the tree.',
        mature: 'The existing CNN classified the photographed fruit as ripe. Inspect this fruit before harvesting; this does not mean the whole farm is ready.',
      },
    },
    tl: {
      title: 'Pagsusuri ng Pagkahinog Gamit ang CNN',
      analysisDesc: 'Resulta ng kasalukuyang CNN at gabay para sa bungang nasa larawan.',
      confidenceNA: 'Hindi available ang kumpiyansa',
      assessmentImageAlt: 'Larawan ng bungang sinuri para sa pagkahinog',
      recommendationSource: 'Gabay batay sa resulta ng CNN',
      recommendationDisclaimer: 'Pangkalahatang gabay lamang ito. Para lamang sa bungang nasa larawan ang resultang hinog, hindi sa buong puno o bukid.',
      resultLabels: {
        immature: 'Hindi Pa Hinog',
        mature: 'Hinog',
      },
      resultDescriptions: {
        immature: 'Inuri ng kasalukuyang CNN na hindi pa hinog ang bungang nasa larawan. Patuloy itong subaybayan habang nasa puno.',
        mature: 'Inuri ng kasalukuyang CNN na hinog ang bungang nasa larawan. Suriin muna ang bungang ito bago anihin; hindi ito nangangahulugang handa na ang buong bukid.',
      },
    },
  };
  const t = { ...translations[language], ...maturityFlowText[language] };
  const localizedResult = result && language === 'tl'
    ? { ...result, stage: t.resultLabels[result.readiness] || result.stage, description: t.resultDescriptions[result.readiness] || result.description }
    : result;

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const advice = result && !result.canRetry ? maturityAdvice(result.readiness, language) : null;
  const displayResult = advice ? { ...result, ...advice } : result;

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Invalid file type', {
          description: 'Please select an image file (JPG, PNG, etc.)',
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result);
        setResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const isMobileDevice = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  const attachStreamToVideo = async (mediaStream) => {
    setShowCamera(true);
    setCameraReady(false);

    const attach = async (attempt = 0) => {
      if (!mediaStream.active) return;
      if (!videoRef.current) {
        if (attempt < 10) {
          setTimeout(() => attach(attempt + 1), 100);
        }
        return;
      }
      videoRef.current.srcObject = mediaStream;
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;

      try {
        await videoRef.current.play();
      } catch (error) {
        setTimeout(() => {
          videoRef.current?.play?.().catch(() => {});
        }, 150);
      }
    };

    attach();
  };

  const openCamera = async () => {
    if (isMobileDevice()) {
      cameraInputRef.current?.click();
      return;
    }

    try {
      let mediaStream;

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (primaryError) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      }

      setStream(mediaStream);
      await attachStreamToVideo(mediaStream);
    } catch (error) {
      toast.error('Camera Error', {
        description: 'Unable to access camera. Please check permissions.',
      });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video.videoWidth || !video.videoHeight) {
        toast.error('Camera not ready', {
          description: 'Please wait until the camera preview appears before capturing.',
        });
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/png');
        setSelectedImage(imageData);
        setResult(null);
        closeCamera();

        toast.success('Photo Captured', {
          description: 'Image ready for analysis',
        });
      }
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setShowCamera(false);
  };

  const handleClearSelection = () => {
    setSelectedImage(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const analyzeImage = () => {
    if (!selectedImage || isAnalyzing) return;

    setIsAnalyzing(true);
    setResult(null);

    // convert dataURL to blob if needed
    const dataURLtoFile = (dataurl, filename = 'image.png') => {
      const arr = dataurl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    };

    (async () => {
      try {
        let file;
        if (selectedImage.startsWith('data:')) {
          file = dataURLtoFile(selectedImage);
        } else {
          // If it's an object URL or File object
          file = selectedImage instanceof File ? selectedImage : null;
        }

        if (!file) {
          toast.error('No valid image to analyze');
          setIsAnalyzing(false);
          return;
        }

        const fd = new FormData();
        fd.append('image', file);

        const res = await apiFetch('/api/predict_rambutan/', {
          method: 'POST',
          body: fd
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Server error' }));
          const message = err.code === 'fruit_verifier_unavailable' && language === 'tl'
            ? 'Hindi gumagana ang pagsusuri ng prutas ngayon. Subukan ulit mamaya.'
            : err.message || err.error || 'Could not check the photo. Please try again.';
          toast.error(language === 'tl' ? 'Hindi nasuri ang larawan' : 'Photo could not be checked', { description: message });
          setIsAnalyzing(false);
          return;
        }

        const data = await res.json();
		// data: { type:'rambutan', label, confidence, message? }
		if (data.label === 'not_rambutan' || data.label === 'unknown') {
			const uncertain = data.label === 'unknown';
			const title = uncertain
              ? (language === 'tl' ? 'Hindi matiyak kung hinog' : 'Ripeness is unclear')
              : (language === 'tl' ? 'Hindi matiyak na rambutan' : 'Rambutan not confirmed');
			const message = language === 'tl'
              ? (uncertain ? 'Kunan ulit nang mas malapit at maliwanag ang rambutan.' : 'Rambutan lamang. Ilapit ang bunga para makita ang balat at mga buhok nito.')
              : data.message || 'Please take a clear close-up of rambutan.';
			toast.error(title, { description: message });
			const invalidResult = {
				stage: title,
				readiness: data.label,
				confidence: null,
				message,
				canRetry: true
			};
			setResult(invalidResult);
          setIsAnalyzing(false);

          return;
        }

        const readiness = maturityReadiness(data.classification || data.label, data.class_names);
        if (!readiness || data.rambutan_verified !== true) {
          throw new Error(language === 'tl' ? 'Hindi matiyak na rambutan ito. Kunan ulit nang mas malapit.' : 'Rambutan could not be confirmed. Take a closer photo.');
        }
        const confidence = Number(data.confidence);
        const confidencePercent = Number.isFinite(confidence) && confidence >= 0 && confidence <= 1
          ? (confidence * 100).toFixed(1)
          : null;
        const out = {
          ...maturityAdvice(readiness, language),
          confidence: confidencePercent,
          predictionId: data.storage?.saved && Number.isInteger(data.storage.prediction_id)
            ? data.storage.prediction_id
            : null,
          imageUrl: data.image_url || null,
          storage: data.storage,
        };

        setResult(out);
        setHistoryRevision((value) => value + 1);
        setIsAnalyzing(false);
        if (typeof onAnalysisComplete === 'function') onAnalysisComplete(out);

      } catch (err) {
        console.error(err);
        toast.error('Analysis error', { description: err.message || String(err) });
        setIsAnalyzing(false);
      }
    })();
  };

  const getReadinessColor = (readiness) => {
    switch (readiness) {
      case 'mature':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'immature':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getReadinessIcon = (readiness) => {
    switch (readiness) {
      case 'mature':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'immature':
        return <Info className="w-5 h-5 text-blue-600" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-4 text-base sm:space-y-6 sm:text-lg">
      <div className="scan-layout">
        {/* Upload Section */}
        <Card className="bg-white shadow-lg border-2 border-gray-100">
          <CardHeader>
            <CardTitle className="text-sm text-gray-900 sm:text-base">{t.captureUploadTitle}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t.captureUploadDesc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!selectedImage ? (
              <div className="border-2 border-dashed border-emerald-300 rounded-lg p-6 text-center hover:border-emerald-500 transition-colors sm:p-12">
                <div className="flex flex-col items-center gap-2 sm:gap-4">
                  <div className="p-3 bg-gradient-to-br from-emerald-100 to-green-100 rounded-full sm:p-4">
                    <FileImage className="w-6 h-6 text-emerald-600 sm:w-8 sm:h-8" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-gray-900">{t.capturePrompt}</p>
                    <p className="text-base text-gray-600">{t.supported}</p>
                  </div>
                  <div className="scan-actions">
                    <Button
                      onClick={openCamera}
                      className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 sm:w-auto"
                    >
                      <Camera className="w-4 h-4" />
                      {t.takePhoto}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full gap-2 border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 sm:w-auto"
                    >
                      <Upload className="w-4 h-4" />
                      {t.uploadImage}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-lg overflow-hidden border-2 border-emerald-200 shadow-md">
                  <img
                    src={selectedImage}
                    alt="Selected rambutan"
                    className="h-64 w-full bg-slate-50 object-contain sm:h-80"
                  />
                </div>
                <div className="scan-actions">
                  <Button
                    onClick={analyzeImage}
                    disabled={isAnalyzing}
                    className="flex-1 gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t.analyzingMaturity}
                      </>
                    ) : (
                      <>
                        <Apple className="w-4 h-4" />
                        {t.analyzeMaturity}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClearSelection}
                    disabled={isAnalyzing}
                    className="w-full border-2 sm:w-auto"
                  >
                    {t.clear}
                  </Button>
                </div>
              </div>
            )}

            {isAnalyzing && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-base">
                  <span className="text-gray-600">{t.analyzingMaturity}</span>
                  <span className="text-gray-900">{t.step}</span>
                </div>

                <p className="text-sm leading-6 text-gray-500">
                  {t.analyzingDesc}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="bg-white shadow-lg border-2 border-gray-100">
          <CardHeader>
            <CardTitle className="text-gray-900">{t.analysisTitle}</CardTitle>
            <CardDescription>
              {t.analysisDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!localizedResult ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full mb-4">
                  <Apple className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-900">{t.noResults}</p>
                <p className="text-base text-gray-600">{t.uploadToResults}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <ScanSaveStatus storage={result?.storage} language={language} />
                {(selectedImage || result.imageUrl) && (
                  <img
                    src={selectedImage || result.imageUrl}
                    alt={t.assessmentImageAlt}
                    className="max-h-64 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"
                  />
                )}
                {/* Maturity Result */}
                <div className={`p-4 rounded-lg border-2 ${localizedResult.readiness === 'not_rambutan' ? 'border-red-300 bg-red-50' : getReadinessColor(localizedResult.readiness)}`}>
                  <div className="flex items-start gap-3">
                    {localizedResult.readiness === 'not_rambutan' ? (
                      <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-1" />
                    ) : (
                      getReadinessIcon(localizedResult.readiness)
                    )}
                    <div className="flex-1">
                      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-lg">{displayResult.stage}</h3>
                        {!result.canRetry && <Badge variant="secondary" className="bg-white/80">
                          {result.confidence != null
                            ? `${result.confidence}% ${t.confident}`
                            : t.confidenceNA}
                        </Badge>}
                      </div>
                      <p className="text-base leading-7 opacity-90">{displayResult.description || result.message}</p>
                    </div>
                  </div>

                  {/* Try Again Button for not_rambutan */}
                  {result.canRetry && (
                    <div className="mt-4 pt-4 border-t border-red-200">
                      <Button
                        onClick={handleClearSelection}
                        className="w-full bg-red-600 hover:bg-red-700 text-white"
                      >
                        {language === 'tl' ? 'Kumuha ng ibang larawan' : 'Try another photo'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Confidence Score - hidden for not_rambutan */}
                {!result.canRetry && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-base">
                    <span className="text-gray-600">{t.confidenceLevel}</span>
                    <span className="text-gray-900">{result.confidence != null ? `${result.confidence}%` : t.confidenceNA}</span>
                  </div>
                  {result.confidence != null && (
                    <Progress value={Number(result.confidence)} className="h-2" />
                  )}
                </div>
                )}

                {/* Characteristics - hidden for not_rambutan */}
                {result.readiness !== 'not_rambutan' && result.characteristics && result.characteristics.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-base text-gray-900">{t.observed}</h4>
                    <ul className="space-y-2">
                      {result.characteristics.map((char, index) => (
                        <li key={index} className="flex items-start gap-2 text-base leading-7 text-gray-700">
                          <div className="h-1.5 w-1.5 bg-orange-500 rounded-full mt-1.5" />
                          <span>{char}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!result.canRetry && <div className="rounded-lg border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-emerald-900">{t.recommendationSource}</h4>
                  </div>
                  <p className="text-sm leading-6 text-emerald-950">{displayResult.action}</p>
                  <p className="mt-2 text-xs leading-5 text-emerald-900">{t.recommendationDisclaimer}</p>
                </div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PredictionTransactions
        key={historyRevision}
        predictionType="rambutan"
        viewMode="timeline"
      />
      <HarvestRecords predictionId={result && !result.canRetry ? result.predictionId : null} />

      {/* Harvesting Recommendations - hidden for notRambutan */}
      {result && !result.canRetry && displayResult.harvestingTips && displayResult.harvestingTips.length > 0 && (
        <Card className="bg-white shadow-lg border-2 border-gray-100">
          <CardHeader>
              <CardTitle className="text-gray-900">{t.harvesting}</CardTitle>
            <CardDescription>
                {t.harvestingDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4 border-2 border-orange-200 bg-orange-50">
              <Info className="h-4 w-4 text-orange-600" />
              <AlertTitle className="text-orange-900">{t.critical}</AlertTitle>
              <AlertDescription className="text-orange-800">
                {t.criticalDesc}
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm text-gray-900 mb-3">{t.guidelines}</h4>
                <div className="space-y-3">
                  {displayResult.harvestingTips.map((tip, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border-2 border-orange-200">
                      <div className="flex items-center justify-center w-6 h-6 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-full text-xs shrink-0">
                        {index + 1}
                      </div>
                      <p className="text-base leading-7 text-orange-900">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              {displayResult.storageAdvice.length > 0 && (
                <div>
                  <h4 className="text-sm text-gray-900 mb-3">{t.storage}</h4>
                  <div className="space-y-2">
                    {displayResult.storageAdvice.map((advice, index) => (
                      <div key={index} className="flex items-start gap-2 text-base leading-7 text-gray-700">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                        <span>{advice}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Guide */}
      <Card className="bg-gradient-to-br from-orange-50 to-red-50 shadow-lg border-2 border-orange-200">
        <CardHeader>
          <CardTitle className="text-gray-900">{t.tipsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg">
                  <Camera className="w-5 h-5 text-orange-600" />
                </div>
              <div>
                <h4 className="text-sm text-gray-900 mb-1">{t.naturalLight}</h4>
                <p className="text-xs text-gray-600">{t.naturalLightDesc}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg">
                <Apple className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h4 className="text-sm text-gray-900 mb-1">{t.multipleAngles}</h4>
                <p className="text-xs text-gray-600">{t.multipleAnglesDesc}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h4 className="text-sm text-gray-900 mb-1">{t.dailyMonitoring}</h4>
                <p className="text-xs text-gray-600">{t.dailyMonitoringDesc}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCamera} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.captureTitle}</DialogTitle>
            <DialogDescription>
              {t.captureDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              {!cameraReady && (
                <div className="absolute inset-0 z-10 flex min-h-[260px] items-center justify-center bg-black text-sm text-white">
                  Starting camera...
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => {
                  setCameraReady(true);
                  videoRef.current?.play?.().catch(() => {});
                }}
                onCanPlay={() => setCameraReady(true)}
                className="min-h-[260px] w-full bg-black object-contain"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="scan-actions">
              <Button variant="outline" onClick={closeCamera}>
                {t.close}
              </Button>
              <Button
                onClick={capturePhoto}
                disabled={!cameraReady}
                className="gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
              >
                <Camera className="w-4 h-4" />
                {t.capture}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
