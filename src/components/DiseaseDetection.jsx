import { apiFetch } from '../lib/apiFetch.mjs';
import { useState, useRef, useContext, useEffect } from "react";
import { LanguageContext } from '../LanguageContext';
import { leafScanNotice } from '../lib/leafScanResponse.mjs';
import { useDiseaseStats } from '../hooks/useDiseaseStats.mjs';
import { recommendationPresentation } from '../lib/recommendationPresentation.mjs';
import ScanSaveStatus from './ScanSaveStatus';
import { translations } from '../translation';
import algalLeafSpotImage from '../assets/antracnose-removebg-preview.png';
import anthracnoseImage from '../assets/algal_spot-removebg-preview.png';
import leafCurlImage from '../assets/leaf-curl.jpg';
import powderyMildewImage from '../assets/powdery-mildew.jpg';
import sootyMoldImage from '../assets/SOOTY_MOLD-removebg-preview.png';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Progress } from "./ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  Upload,
  Camera,
  Leaf,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Info,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner@2.0.3";

const LeafScan3DIcon = ({ className = 'h-14 w-14' }) => (
  <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="leaf-scan-body" x1="14" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="#bbf7d0" />
        <stop offset="0.52" stopColor="#22c55e" />
        <stop offset="1" stopColor="#15803d" />
      </linearGradient>
      <linearGradient id="leaf-scan-vein" x1="20" y1="18" x2="46" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#ecfdf5" stopOpacity=".95" />
        <stop offset="1" stopColor="#86efac" stopOpacity=".45" />
      </linearGradient>
      <filter id="leaf-scan-shadow" x="0" y="0" width="64" height="64"><feDropShadow dx="2" dy="3" stdDeviation="2.5" floodColor="#166534" floodOpacity=".28" /></filter>
    </defs>
    <path d="M49 10C29 10 16 21 16 39c0 8 5 13 12 13 18 0 25-18 21-42Z" fill="url(#leaf-scan-body)" filter="url(#leaf-scan-shadow)" />
    <path d="M22 45C29 36 35 29 45 16M30 39l-7-1M35 32l-1-8M40 26l7 1" stroke="url(#leaf-scan-vein)" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M15 50c9-1 15-5 20-12" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
    <circle cx="48" cy="46" r="10" fill="#fff" stroke="#a7f3d0" strokeWidth="2" />
    <circle cx="46.5" cy="44.5" r="3.5" stroke="#059669" strokeWidth="2" />
    <path d="m49 47 3.5 3.5" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const AiPlant3DIcon = ({ className = 'h-12 w-12' }) => (
  <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="ai-plant-box" x1="9" y1="6" x2="38" y2="42" gradientUnits="userSpaceOnUse"><stop stopColor="#c4b5fd" /><stop offset="1" stopColor="#6d28d9" /></linearGradient>
      <filter id="ai-plant-shadow" x="0" y="0" width="48" height="48"><feDropShadow dx="1" dy="2" stdDeviation="2" floodColor="#5b21b6" floodOpacity=".3" /></filter>
    </defs>
    <rect x="7" y="7" width="34" height="34" rx="11" fill="url(#ai-plant-box)" filter="url(#ai-plant-shadow)" />
    <path d="M24 32V18M24 25c-6 0-8-4-8-8 5 0 8 3 8 8Zm0 0c6 0 8-4 8-8-5 0-8 3-8 8Z" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="34" cy="14" r="4" fill="#fef3c7" /><path d="m34 11 .7 2.3L37 14l-2.3.7L34 17l-.7-2.3L31 14l2.3-.7L34 11Z" fill="#f59e0b" />
  </svg>
);

export default function DiseaseDetection({ onAnalysisComplete, onRequestActiveTab, onCaptureFlowChange, isActive = true }) {
  const { language } = useContext(LanguageContext);
  const t = translations[language];
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [scanNotice, setScanNotice] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState(null);
  const [nlpSummary, setNlpSummary] = useState('');
  const [nlpSource, setNlpSource] = useState('fallback');
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [aiRecommendationState, setAiRecommendationState] = useState('idle');
  const [typedRecommendation, setTypedRecommendation] = useState('');
  const [aiRecommendationRevealStep, setAiRecommendationRevealStep] = useState(0);
  const [typedAiRecommendationHeader, setTypedAiRecommendationHeader] = useState('');
  const [typedAiRecommendationSubtitle, setTypedAiRecommendationSubtitle] = useState('');
  const [typedDiagnosisLine, setTypedDiagnosisLine] = useState('');
  const [typedRiskLine, setTypedRiskLine] = useState('');
  const [typedActionLine, setTypedActionLine] = useState('');
  const { stats, error: statsError, refresh: refreshStats } = useDiseaseStats(isActive);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mobileCapturePendingRef = useRef(false);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  // General care references; product choice for rambutan needs local advice.
  // Algal spots: https://www3.ctahr.hawaii.edu/nelsons/glossary/Algal_leaf_spot.htm
  // Anthracnose: https://ask.ifas.ufl.edu/publication/EP659
  // Sooty mold and insects: https://ipm.ucanr.edu/home-and-landscape/sooty-mold/
  // Mildew: https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/yard-and-garden-problems/powdery-mildew-on-trees-and-shrubs
  const diseases = [
    {
      disease: "Algal Leaf Spot (Black Spots)",
      confidence: 91.3,
      image: algalLeafSpotImage,
      severity: "mild",
      description: "Caused by algae growing on leaf surfaces in high humidity environments.",
      symptoms: [
        "Circular gray-green spots on leaves",
        "Velvety or fuzzy appearance",
        "Mostly cosmetic damage",
        "Can reduce photosynthesis if severe",
      ],
      treatments: [
        "Trim a few crowded small branches so air can pass through.",
        "When watering, wet the soil instead of the leaves.",
        "Check new leaves for more spots.",
        "If spots keep spreading, show the leaves to your local agriculture worker.",
      ],
      preventionTips: [
        "Keep enough space between branches for leaves to dry.",
        "Check the leaves more often during rainy weather.",
      ],
    },
    {
      disease: "Anthracnose",
      confidence: 89.2,
      severity: "moderate",
      description: "Dark brown or black spots form on leaves, stems, or fruits. The spots may grow bigger and cause parts of the plant to rot or die.",
      symptoms: [
        "Dark brown to black spots on leaves",
        "Lesions with yellow halos",
        "Premature leaf drop",
        "Fruit rot in severe cases",
      ],
      treatments: [
        "Collect fallen leaves and rotten fruit from under the tree.",
        "Remove badly damaged leaves, but leave the healthy ones.",
        "When watering, wet the soil instead of the leaves.",
        "If spots spread or fruit starts rotting, ask your local agriculture worker for help.",
      ],
      preventionTips: [
        "Clean your pruning tools before using them on another tree.",
        "Trim crowded small branches when the leaves are dry.",
        "Check nearby trees for the same spots.",
      ],
    },
    {
      disease: "Powdery Mildew",
      confidence: 87.8,
      image: powderyMildewImage,
      severity: "mild",
      description: "White or gray powder-like spots appear on the leaves. It spreads quickly and can make the leaves dry and weak.",
      symptoms: [
        "White powdery coating on leaves",
        "Leaf curling and distortion",
        "Yellowing of affected areas",
        "Stunted growth in young shoots",
      ],
      treatments: [
        "Collect fallen leaves with white patches.",
        "Avoid adding extra fertilizer to try to cure the leaves.",
        "Check new leaves for white patches.",
        "If white patches keep spreading, ask your local agriculture worker which treatment to use.",
      ],
      preventionTips: [
        "Leave enough space between trees for air to pass through.",
        "Use only the recommended amount of fertilizer.",
      ],
    },
    {
      disease: "Sooty Mold",
      confidence: 85.4,
      image: sootyMoldImage,
      severity: "moderate",
      description: "Black, powdery coating covers the surface of the leaves. It grows on the sticky substance left by insects like aphids. It can block sunlight and affect plant growth.",
      symptoms: [
        "Black powdery coating on leaf surfaces",
        "Sticky honeydew residue from insects",
        "Reduced light reaching the leaf",
        "Weakened plant growth over time",
      ],
      treatments: [
        "Look under the leaves for small insects and sticky patches.",
        "Gently rinse the black coating off with clean water.",
        "If you find insects, ask your local agriculture worker how to control them.",
        "Check whether the black coating returns after cleaning.",
      ],
      preventionTips: [
        "Check new leaves for insects and sticky patches.",
        "Deal with the insects early so the black coating does not return.",
      ],
    },
    {
      disease: "Leaf Curl",
      confidence: 86.5,
      image: leafCurlImage,
      severity: "moderate",
      description: "Viral or environmental disorder causing leaves to curl and distort. Common in stress conditions.",
      symptoms: [
        "Upward or downward leaf curling",
        "Leaves become thick and leathery",
        "Yellowing between leaf veins",
        "Reduced leaf size",
        "Stunted shoot growth",
      ],
      treatments: [
        "Look under curled leaves for small insects.",
        "Check the soil and water if it is dry.",
        "Avoid adding extra fertilizer to try to fix curled leaves.",
        "If new leaves also curl, show them to your local agriculture worker.",
      ],
      preventionTips: [
        "Do not let water collect around the tree.",
        "Check the soil more often during hot, dry weather.",
        "Check new leaves for insects regularly.",
      ],
    },
    {
      disease: "Healthy Leaf",
      confidence: 94.5,
      severity: "healthy",
      description: "The leaf appears healthy with no signs of disease or pest damage.",
      symptoms: ["Vibrant green color", "No discoloration", "No visible lesions or spots"],
      treatments: [
        "No treatment is needed for this leaf right now.",
        "Check the soil and water if it is dry.",
        "Keep checking leaves for new spots or insects.",
      ],
      preventionTips: [
        "Clear fallen leaves and rotten fruit from under the tree.",
        "Use only the recommended amount of fertilizer.",
        "Clean your pruning tools before using them on another tree.",
      ],
    },
  ];

  const diseaseReferenceFrames = [
    {
      name: language === 'tl' ? 'Algal Spot' : 'Algal Spot',
      detail: language === 'tl' ? 'May orange o brown na bilog-bilog na spots sa dahon' : 'Orange or brown circular spots on leaves',
      image: algalLeafSpotImage,
      badgeClass: 'bg-orange-500',
    },
    {
      name: language === 'tl' ? 'Anthracnose' : 'Anthracnose',
      detail: language === 'tl' ? 'May dark brown o black na patay na spots sa dahon' : 'Dark sunken lesions on fruit/leaves',
      image: anthracnoseImage,
      badgeClass: 'bg-teal-500',
    },
    {
      name: language === 'tl' ? 'Sooty Mold' : 'Sooty Mold',
      detail: language === 'tl' ? 'May itim na parang uling o dumi sa ibabaw ng dahon' : 'Black powdery coating on surface',
      image: sootyMoldImage,
      badgeClass: 'bg-slate-700',
    },
  ];

  const localizedDiseaseContent = {
    'Algal Leaf Spot (Black Spots)': {
      tl: {
        disease: 'Algal Leaf Spot (Maiitim na Batik)',
        description: 'Dulot ito ng algae na tumutubo sa ibabaw ng dahon kapag mataas ang halumigmig.',
        symptoms: [
          'Pabilog na kulay abo-berdeng batik sa dahon',
          'May mukhang velvety o malabong balot',
          'Kadalasang panlabas lang ang pinsala',
          'Puwedeng makaapekto sa photosynthesis kapag lumala',
        ],
        treatments: [
          'Bawasan ang ilang maliliit na sanga na siksikan para makadaan ang hangin.',
          'Sa lupa magdilig, hindi sa mga dahon.',
          'Tingnan kung may dagdag na batik sa mga bagong dahon.',
          'Kapag patuloy na kumakalat ang batik, ipakita ang dahon sa teknisyan sa agrikultura sa inyong lugar.',
        ],
        preventionTips: [
          'Panatilihing may pagitan ang mga sanga para madaling matuyo ang dahon.',
          'Mas madalas tingnan ang mga dahon kapag tag-ulan.',
        ],
      },
    },
    Anthracnose: {
      tl: {
        description: 'Nagkakaroon ng dark brown o itim na spots sa dahon, tangkay, o bunga. Puwede itong lumaki at maging sanhi ng pagkabulok o pagkamatay ng bahagi ng halaman.',
        symptoms: [
          'Dark brown hanggang itim na batik sa dahon',
          'May sugat na may dilaw na palibot',
          'Maagang pagkalagas ng dahon',
          'Pagkabulok ng bunga kapag malala',
        ],
        treatments: [
          'Pulutin ang mga nalaglag na dahon at bulok na bunga sa ilalim ng puno.',
          'Alisin ang mga dahong malubha ang pinsala. Iwan ang malulusog na dahon.',
          'Sa lupa magdilig, hindi sa mga dahon.',
          'Kapag kumakalat ang batik o nabubulok ang bunga, humingi ng tulong sa teknisyan sa agrikultura.',
        ],
        preventionTips: [
          'Linisin ang gunting bago gamitin sa ibang puno.',
          'Bawasan ang siksik na maliliit na sanga kapag tuyo ang mga dahon.',
          'Tingnan kung may kaparehong batik sa mga kalapit na puno.',
        ],
      },
    },
    'Powdery Mildew': {
      tl: {
        description: 'May puti o abong parang pulbos na spots sa dahon. Mabilis itong kumalat at maaaring magpatuyo at magpahina sa mga dahon.',
        symptoms: [
          'Puting parang pulbos na balot sa dahon',
          'Pagkakulubot at pagbaluktot ng dahon',
          'Paninilaw ng apektadong bahagi',
          'Pagbagal ng paglaki ng mga bagong usbong',
        ],
        treatments: [
          'Pulutin ang mga nalaglag na dahon na may puting balot.',
          'Huwag dagdagan ang pataba para lang gamutin ang mga dahon.',
          'Tingnan kung may puting balot sa mga bagong dahon.',
          'Kapag kumakalat ang puting balot, itanong sa teknisyan sa agrikultura ang tamang panggamot.',
        ],
        preventionTips: [
          'Mag-iwan ng sapat na pagitan sa mga puno para makadaan ang hangin.',
          'Sundin ang tamang dami ng pataba.',
        ],
      },
    },
    'Sooty Mold': {
      tl: {
        description: 'May maitim na parang pulbos na balot sa ibabaw ng dahon. Tumutubo ito sa malagkit na substance na iniiwan ng mga insektong tulad ng aphids. Maaari nitong harangan ang sikat ng araw at pabagalin ang paglaki ng halaman.',
        symptoms: [
          'Maitim na parang pulbos na balot sa ibabaw ng dahon',
          'May malagkit na honeydew mula sa mga insekto',
          'Nababawasan ang liwanag na natatanggap ng dahon',
          'Humihina ang paglaki ng halaman sa paglipas ng panahon',
        ],
        treatments: [
          'Tingnan ang ilalim ng dahon kung may maliliit na insekto at malagkit na bahagi.',
          'Dahan-dahang banlawan ng malinis na tubig ang maitim na balot.',
          'Kung may insekto, itanong sa teknisyan sa agrikultura kung paano ito makokontrol.',
          'Tingnan kung bumabalik ang maitim na balot matapos linisin.',
        ],
        preventionTips: [
          'Tingnan kung may insekto at malagkit na bahagi sa mga bagong dahon.',
          'Agapan ang mga insekto para hindi bumalik ang maitim na balot.',
        ],
      },
    },
    'Leaf Curl': {
      tl: {
        description: 'Ang dahon ay kumukulubot o nababaluktot dahil sa viral o environmental stress. Karaniwan ito kapag hindi maganda ang kondisyon ng halaman.',
        symptoms: [
          'Pataas o pababang pagkakulubot ng dahon',
          'Nagiging makapal at matigas ang dahon',
          'Paninilaw sa pagitan ng mga ugat ng dahon',
          'Pagliit ng dahon',
          'Pagbagal ng paglaki ng usbong',
        ],
        treatments: [
          'Tingnan ang ilalim ng nakakulot na dahon kung may maliliit na insekto.',
          'Tingnan ang lupa at magdilig kung tuyo na.',
          'Huwag dagdagan ang pataba para lang ituwid ang mga dahon.',
          'Kung pati bagong dahon ay kumukulot, ipakita ito sa teknisyan sa agrikultura.',
        ],
        preventionTips: [
          'Huwag hayaang maipon ang tubig sa paligid ng puno.',
          'Mas madalas tingnan ang lupa kapag mainit at walang ulan.',
          'Regular na tingnan kung may insekto sa mga bagong dahon.',
        ],
      },
    },
    'Healthy Leaf': {
      tl: {
        disease: 'Malusog na Dahon',
        description: 'Mukhang malusog ang dahon at walang malinaw na palatandaan ng sakit o pinsala mula sa peste.',
        symptoms: [
          'Luntiang kulay ng dahon',
          'Walang pagbabago ng kulay',
          'Walang nakikitang batik o sugat',
        ],
        treatments: [
          'Walang kailangang panggamot sa dahong ito sa ngayon.',
          'Tingnan ang lupa at magdilig kung tuyo na.',
          'Regular na tingnan kung may bagong batik o insekto sa mga dahon.',
        ],
        preventionTips: [
          'Pulutin ang mga nalaglag na dahon at bulok na bunga sa ilalim ng puno.',
          'Sundin ang tamang dami ng pataba.',
          'Linisin ang gunting bago gamitin sa ibang puno.',
        ],
      },
    },
    Unknown: {
      tl: {
        disease: 'Hindi Matukoy',
        description: 'May dahon na nakita pero hindi sapat ang kumpiyansa ng model para matukoy ang eksaktong sakit.',
      },
    },
  };

  const getLocalizedDiseaseValue = (diseaseName, key, fallbackValue) => {
    if (language !== 'tl') return fallbackValue;

    const localized = localizedDiseaseContent[diseaseName]?.tl;
    return localized?.[key] || fallbackValue;
  };

  const getRiskLevelLabel = (severity) => {
    if (severity !== 'healthy') return language === 'tl' ? 'Hindi pa nasuri' : 'Not assessed';
    if (language === 'tl') {
      if (severity === 'healthy') return 'Mababa';
      if (severity === 'mild') return 'Katamtaman';
      if (severity === 'moderate' || severity === 'unknown') return 'Mataas';
      return 'Mataas';
    }

    if (severity === 'healthy') return 'Low';
    if (severity === 'mild') return 'Moderate';
    if (severity === 'moderate' || severity === 'unknown') return 'High';
    return 'High';
  };

  const getActionRequiredLabel = (severity) => {
    if (severity !== 'healthy') return language === 'tl' ? 'Suriin at bantayan' : 'Inspect and monitor';
    if (language === 'tl') {
      if (severity === 'healthy') return 'Bantayan';
      if (severity === 'mild') return 'Sa Lalong Madaling Panahon';
      return 'Agad';
    }

    if (severity === 'healthy') return 'Monitor';
    if (severity === 'mild') return 'Soon';
    return 'Immediate';
  };

  const handleFileSelect = (event) => {
    onRequestActiveTab?.('disease');
    mobileCapturePendingRef.current = false;
    onCaptureFlowChange?.(false);

    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Invalid file type", { description: "Please select an image file (JPG, PNG, etc.)" });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        onRequestActiveTab?.('disease');
        setSelectedImage(e.target?.result);
        setResult(null);
        setScanNotice(null);
      };
      reader.onerror = () => {
        onCaptureFlowChange?.(false);
        toast.error("Image Error", { description: "Unable to read the selected image." });
      };
      reader.readAsDataURL(file);
      return;
    }

    onCaptureFlowChange?.(false);
  };

  const isMobileDevice = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  const attachStreamToVideo = async (mediaStream) => {
    setShowCamera(true);

    const attach = async (attempt = 0) => {
      if (!mediaStream.active) return;
      if (!videoRef.current) {
        if (attempt < 10) setTimeout(() => attach(attempt + 1), 100);
        return;
      }
      videoRef.current.srcObject = mediaStream;
      videoRef.current.muted = true;

      try {
        await videoRef.current.play();
      } catch (error) {
        // Some mobile browsers need the dialog to finish rendering first.
        setTimeout(() => {
          videoRef.current?.play?.().catch(() => {});
        }, 150);
      }
    };
    attach();
  };

  const openCamera = async () => {
    onRequestActiveTab?.('disease');
    onCaptureFlowChange?.(true);

    if (isMobileDevice()) {
      mobileCapturePendingRef.current = true;
      cameraInputRef.current?.click();
      return;
    }

    try {
      let mediaStream;

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (primaryError) {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
          },
          audio: false,
        });
      }

      setStream(mediaStream);
      await attachStreamToVideo(mediaStream);
    } catch (error) {
      if (isMobileDevice()) {
        mobileCapturePendingRef.current = true;
        cameraInputRef.current?.click();
        return;
      }

      onCaptureFlowChange?.(false);
      toast.error("Camera Error", { description: "Unable to access camera. Please check permissions." });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video.videoWidth || !video.videoHeight) {
        toast.error('Camera not ready', { description: 'Wait for the camera preview before capturing.' });
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL("image/png");
        setSelectedImage(imageData);
        setResult(null);
        setScanNotice(null);
        onCaptureFlowChange?.(false);
        closeCamera();
        toast.success("Photo Captured", { description: "Image ready for analysis" });
      }
    }
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
    if (!mobileCapturePendingRef.current) {
      onCaptureFlowChange?.(false);
    }
  };

  useEffect(() => {
    const keepDiseaseTabActive = () => {
      if (!mobileCapturePendingRef.current) return;

      onRequestActiveTab?.('disease');
      onCaptureFlowChange?.(true);

      setTimeout(() => {
        onRequestActiveTab?.('disease');
        mobileCapturePendingRef.current = false;
        onCaptureFlowChange?.(false);
      }, 250);
    };

    window.addEventListener('focus', keepDiseaseTabActive);
    window.addEventListener('pageshow', keepDiseaseTabActive);
    document.addEventListener('visibilitychange', keepDiseaseTabActive);

    return () => {
      window.removeEventListener('focus', keepDiseaseTabActive);
      window.removeEventListener('pageshow', keepDiseaseTabActive);
      document.removeEventListener('visibilitychange', keepDiseaseTabActive);
    };
  }, [onCaptureFlowChange, onRequestActiveTab]);

  const analyzeImage = () => {
    if (!selectedImage || isAnalyzing) return;

    setIsAnalyzing(true);
    setResult(null);
    setScanNotice(null);

    const dataURLtoFile = (dataurl, filename = null) => {
      const arr = dataurl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const name = filename || `leaf_${Date.now()}.png`;
      return new File([u8arr], name, { type: mime });
    };

    // Send the complete photo so the backend verifies what the farmer sees.
    (async () => {
      try {
        let file;
        if (selectedImage.startsWith && selectedImage.startsWith('data:')) {
          file = dataURLtoFile(selectedImage);
        } else {
          file = selectedImage instanceof File ? selectedImage : null;
        }

        if (!file) {
          toast.error('No valid image to analyze');
          setIsAnalyzing(false);
          return;
        }

        const fd = new FormData();
        fd.append('image', file);

        const res = await apiFetch('/api/predict_leaf/', { method: 'POST', body: fd });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.storage?.saved) refreshStats();
        if (!res.ok) {
          const notice = {
            title: language === 'tl' ? 'Hindi nasuri ang larawan' : 'Photo could not be checked',
            message: data.code === 'leaf_verifier_unavailable' && language === 'tl'
              ? 'Hindi gumagana ang pagsusuri ng dahon ngayon. Subukan ulit mamaya.'
              : data.message || data.error || `Request failed (HTTP ${res.status}).`,
          };
          setScanNotice(notice);
          toast.error(notice.title, { description: notice.message });
          setIsAnalyzing(false);
          return;
        }
        const notice = leafScanNotice(data, language);
        if (notice) {
          setScanNotice(notice);
          toast.warning(notice.title, { description: notice.message });
          setIsAnalyzing(false);
          return;
        }
        const confidencePct = (data.confidence * 100).toFixed(1);

        const numericLabel = String(data.label).match(/^(?:class_)?(\d+)$/);
        const properDiseaseName = numericLabel ? data.class_names?.[Number(numericLabel[1])] : data.label;
        if (!properDiseaseName) throw new Error('The disease label could not be read. Please try again.');

        // find matching disease object by name (case-insensitive)
        const normalizedDiseaseName = properDiseaseName.toLowerCase().trim();
        const match = diseases.find((d) => {
          const candidate = d.disease.toLowerCase().trim();
          return candidate === normalizedDiseaseName || candidate.startsWith(`${normalizedDiseaseName} (`);
        });
        const out = match ? { ...match, confidence: confidencePct, raw_probs: data.raw_probs || [], class_names: data.class_names || [], image_name: file.name, server_label: data.label } : { disease: properDiseaseName, confidence: confidencePct, severity: 'unknown', description: '', raw_probs: data.raw_probs || [], class_names: data.class_names || [], image_name: file.name, server_label: data.label };
        out.storage = data.storage;
        setResult(out);
        setIsAnalyzing(false);
        if (typeof onAnalysisComplete === 'function') onAnalysisComplete(out);

      } catch (err) {
        console.error(err);
        toast.error('Analysis error', { description: err.message || String(err) });
        setIsAnalyzing(false);
      }
    })();
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "healthy": return "bg-green-100 text-green-800 border-green-300";
      case "mild": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "moderate": return "bg-orange-100 text-orange-800 border-orange-300";
      case "severe": return "bg-red-100 text-red-800 border-red-300";
      default: return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case "healthy": return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "mild": return <Info className="w-5 h-5 text-yellow-600" />;
      case "moderate": return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case "severe": return <XCircle className="w-5 h-5 text-red-600" />;
      default: return <Info className="w-5 h-5" />;
    }
  };

  const buildFallbackRecommendation = (analysisResult) => {
    if (!analysisResult) return '';

    const diseaseName = analysisResult.disease || analysisResult.server_label || 'the detected condition';
    const severityText = analysisResult.severity === 'healthy'
      ? (language === 'tl' ? 'walang malinaw na nakitang sakit' : 'no clear disease was detected')
      : (language === 'tl' ? 'hindi pa nasusukat ang tindi ng sakit' : 'disease severity has not been measured');

    const firstTreatment = getLocalizedDiseaseValue(diseaseName, 'treatments', analysisResult.treatments || [])[0];
    const firstPrevention = getLocalizedDiseaseValue(diseaseName, 'preventionTips', analysisResult.preventionTips || [])[0];
    const displayName = getLocalizedDiseaseValue(diseaseName, 'disease', diseaseName);

    if (language === 'tl') {
      return `Batay sa resultang ${displayName}, ${severityText}. ${firstTreatment || 'Tingnan kung may pagbabago sa mga dahon.'} ${firstPrevention || 'Panatilihing malinis ang paligid ng puno.'}`;
    }

    return `Based on the detected ${displayName}, ${severityText}. ${firstTreatment || 'Check the leaves for changes.'} ${firstPrevention || 'Keep the area under the tree clean.'}`;
  };

  const recommendation = recommendationPresentation(nlpSummary, nlpSource, language, buildFallbackRecommendation(result));

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setNlpSummary('');
    setNlpSource('fallback');
    setAiRecommendation(null);

    async function loadNlpSummary() {
      if (!result) {
        setNlpSummary('');
        setNlpSource('fallback');
        setAiRecommendation(null);
        return;
      }

      try {
        const res = await apiFetch('/api/disease-recommendation/', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            disease: result.disease || result.server_label,
            label: result.server_label || result.disease,
            confidence: result.confidence,
            language,
          }),
        });
        if (!res.ok) throw new Error('Failed to load disease recommendation');
        const json = await res.json();
        if (!active) return;
        setAiRecommendation(json);
        setNlpSummary(json.assessment || '');
        setNlpSource(json.source || 'fallback');
      } catch (error) {
        if (!active) return;
        setAiRecommendation(null);
        setNlpSummary('');
        setNlpSource('fallback');
      }
    }

    loadNlpSummary();
    return () => {
      active = false;
      controller.abort();
    };
  }, [result, language, selectedImage]);

  useEffect(() => {
    if (!result) {
      setAiRecommendationState('idle');
      setTypedRecommendation('');
      setAiRecommendationRevealStep(0);
      setTypedAiRecommendationHeader('');
      setTypedAiRecommendationSubtitle('');
      setTypedDiagnosisLine('');
      setTypedRiskLine('');
      setTypedActionLine('');
      return undefined;
    }

    const localizedDiagnosisName = getLocalizedDiseaseValue(
      result.disease || result.server_label,
      'disease',
      result.disease || result.server_label || 'Leaf Curl',
    );
    const recommendationText =
  recommendation?.text ||
  buildFallbackRecommendation(result) ||
  getAiInsightText(localizedDiagnosisName);
    const headerText = recommendation.header;
    const subtitleText = recommendation.subtitle;
    const diagnosisText = `${language === 'tl' ? '🧠 Diagnosis' : '🧠 Diagnosis'}: ${localizedDiagnosisName}`;
    const riskText = `${language === 'tl' ? '🔴 Antas ng Panganib' : '🔴 Risk Level'}: ${getRiskLevelLabel(result.severity)}`;
    const actionText = `${language === 'tl' ? '⚡ Kailangang Aksyon' : '⚡ Action Required'}: ${getActionRequiredLabel(result.severity)}`;

    // Diagnosis and safe fallback guidance are already available locally.
    // Render them immediately; the optional server recommendation can replace
    // the text when it arrives without delaying the result screen.
    setAiRecommendationState('done');
    setTypedRecommendation(recommendationText);
    setAiRecommendationRevealStep(6);
    setTypedAiRecommendationHeader(headerText);
    setTypedAiRecommendationSubtitle(subtitleText);
    setTypedDiagnosisLine(diagnosisText);
    setTypedRiskLine(riskText);
    setTypedActionLine(actionText);
    return undefined;
  }, [result, nlpSummary, language, aiRecommendation]);

  useEffect(() => {
    return undefined;
  }, [aiRecommendationState]);

  const displayDiseaseName = result
    ? getLocalizedDiseaseValue(result.disease || result.server_label, 'disease', result.disease || result.server_label)
    : '';
  const displaySymptoms = result
    ? getLocalizedDiseaseValue(result.disease || result.server_label, 'symptoms', result.symptoms || [])
    : [];
  return (
    <div className="space-y-4 text-base sm:space-y-6 sm:text-lg">
      {/* Leaf-disease visual header. The analysis flow and API contract remain unchanged. */}
      <Card className="overflow-hidden border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-teal-50 shadow-sm">
        <CardContent className="p-4 sm:p-5 md:p-7">
          <div className="flex flex-col gap-3 sm:gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-white shadow-[0_8px_22px_rgba(22,101,52,.14)] ring-1 ring-emerald-100 sm:h-20 sm:w-20">
                <LeafScan3DIcon className="h-12 w-12 sm:h-16 sm:w-16" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-black tracking-tight text-slate-800 sm:text-2xl md:text-3xl">{t.title}</h2>
                <p className="mt-1 max-w-xl text-xs leading-4 text-slate-500 sm:text-sm sm:leading-6">{t.subtitle}</p>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:gap-3 sm:grid-cols-4">
            {[
              [t.detectionAccuracy, '94.5%'],
              [t.diseasesTracked, stats?.diseasesTracked ?? '\u2014', language === 'tl' ? 'Lahat ng na-save mong leaf scan na may sakit, kasama ang paulit-ulit na sakit.' : 'All your saved leaf scans with a disease, including repeated detections.'],
              [t.scansToday, stats?.scansToday ?? '\u2014', language === 'tl' ? 'Mga na-save mong leaf scan ngayong araw sa iyong local timezone.' : 'Your saved leaf scans today in your local timezone.'],
              [t.modelVersion, 'v2.1'],
            ].map(([label, value, description]) => (
              <div key={label} title={description} className="rounded-2xl border border-white bg-white/80 px-2 py-2 shadow-sm sm:px-4 sm:py-3"><p className="text-xs font-semibold text-slate-400">{label}</p><p className="mt-1 text-lg font-black text-emerald-700 sm:text-xl">{value}</p></div>
            ))}
          </div>
          {statsError && (
            <p role="status" className="mt-2 text-sm text-amber-800">
              {language === 'tl' ? 'Hindi makuha ang bilang ng scans. ' : 'Scan counts could not be loaded. '}
              <button type="button" onClick={refreshStats} className="font-semibold underline">
                {language === 'tl' ? 'Subukan ulit' : 'Try again'}
              </button>
            </p>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="disease-reference-frames">
        <h3 id="disease-reference-frames" className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500 sm:mb-3">
          {language === 'tl' ? 'Mga Halimbawang Dahon para sa Disease Detection' : 'Disease Reference Frames'}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {diseaseReferenceFrames.map((frame) => (
            <article
              key={frame.name}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm sm:p-4"
            >
              <div className="h-48 w-full shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-slate-100 sm:h-56 lg:h-52">
                <img
                  src={frame.image}
                  alt={`${frame.name} leaf reference`}
                  className="h-full w-full object-contain object-center p-3 sm:p-4"
                />
              </div>
              <span className={`mt-3 inline-flex rounded-full px-4 py-2 text-sm font-bold text-white sm:px-5 sm:py-2.5 sm:text-base ${frame.badgeClass}`}>
                {frame.name}
              </span>
              <p className="mt-2 min-h-8 flex-1 text-sm leading-5 text-slate-500 sm:text-base sm:leading-6">{frame.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="scan-layout">
        {/* Upload Section */}
        <Card className="border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-gray-900 sm:text-base">{t.captureOrUpload}</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {t.captureOrUploadDesc}
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

            <p className="text-base leading-7 text-emerald-800">
              {language === 'tl' ? 'Dahon lamang. Ilapit ang isang dahon at ipakita ang buong gilid nito.' : 'Leaves only. Show one leaf close up, with its edges visible.'}
            </p>

            {!selectedImage ? (
              <div className="rounded-3xl border-2 border-dashed border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white px-4 py-8 text-center transition-colors hover:border-emerald-500 sm:px-6 sm:py-12">
                <div className="flex flex-col items-center gap-2 sm:gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white shadow-[0_8px_20px_rgba(22,101,52,.14)] sm:h-20 sm:w-20">
                    <LeafScan3DIcon className="h-12 w-12 sm:h-16 sm:w-16" />
                  </div>
                  <div className="max-w-md space-y-2 px-1 sm:space-y-3 sm:px-4">
                    <p className="text-xs text-gray-900 leading-5 sm:text-sm sm:leading-7">{t.captureOrUploadPrompt}</p>
                    <p className="text-xs leading-5 text-gray-600 sm:text-base sm:leading-7">{t.supportedFormats}</p>
                  </div>
                  <div className="scan-actions">
                    <Button
                      type="button"
                      onClick={openCamera}
                      className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                    >
                      <Camera className="w-4 h-4" />
                      {t.takePhoto}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-2 border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                    >
                      <Upload className="w-4 h-4" />
                      {t.uploadImage}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative mx-auto h-24 max-w-[220px] overflow-hidden rounded-lg border-2 border-emerald-200 bg-slate-50 shadow-md sm:h-28 sm:max-w-[240px]">
                  <img
                    src={selectedImage}
                    alt="Selected leaf"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="scan-actions">
                  <Button
                    type="button"
                    onClick={analyzeImage}
                    disabled={isAnalyzing}
                    className="flex-1 gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t.analyzing}
                      </>
                    ) : (
                      <>
                        <Leaf className="w-4 h-4" />
                        {t.analyzeLeaf}
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isAnalyzing}
                    onClick={() => {
                      setSelectedImage(null);
                      setResult(null);
                      setScanNotice(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
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
                  <span className="text-gray-600">{t.processing}</span>
                  <span className="text-gray-900">{t.step} 1/3</span>
                </div>
                <Progress value={33} className="h-2" />
                <p className="text-sm leading-6 text-gray-500">
                  {t.aiAnalyzing}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="border border-slate-100 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900">{t.analysisResults}</CardTitle>
            <CardDescription>
              {t.aiDiagnosis}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scanNotice && (
              <Alert role="alert" className="mb-4 border-amber-300 bg-amber-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{scanNotice.title}</AlertTitle>
                <AlertDescription>{scanNotice.message}</AlertDescription>
              </Alert>
            )}
            <ScanSaveStatus storage={result?.storage} language={language} />
            {!result ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-violet-50 ring-1 ring-violet-100">
                  <AiPlant3DIcon className="h-16 w-16" />
                </div>
                <p className="text-gray-900">{t.noResults}</p>
                <p className="text-base text-gray-600">{t.uploadToSeeResults}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-emerald-50 to-white p-5 text-black shadow-lg">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-black">
                    {language === 'tl' ? 'Tapos na ang AI Diagnosis' : 'AI Diagnosis Complete'}
                  </p>
                  <p className="mt-2 text-sm text-black">
                    {isAnalyzing || aiRecommendationState === 'analyzing'
                      ? (language === 'tl' ? 'Sinusuri ang kalagayan ng halaman...' : 'Analyzing plant condition...')
                      : (language === 'tl' ? 'Handa na ang pagsusuri sa kalagayan ng halaman.' : 'Plant condition analysis is ready.')}
                  </p>
                </div>

                {/* Detection Result */}
                <div className={`p-4 rounded-lg border-2 ${getSeverityColor(result.severity)}`}>
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(result.severity)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg">{displayDiseaseName}</h3>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Symptoms */}
                {result.symptoms && result.symptoms.length > 0 && (
                  <div>
                    <h4 className="text-sm text-gray-900 mb-2">{t.observedSymptoms}</h4>
                    <ul className="space-y-2">
                      {displaySymptoms.map((symptom, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                          <div className="h-1.5 w-1.5 bg-orange-500 rounded-full mt-1.5" />
                          <span>{symptom}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50 p-5 shadow-sm transition-all duration-500">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-emerald-950">
                          {recommendation.header}
                        </h4>
                        <p className="text-sm text-emerald-700">
                          {language === 'tl' ? 'Mabilis na gabay batay sa analysis' : 'Quick guidance based on the analysis'}
                        </p>
                      </div>
                    </div>

                  </div>

                  <div className="min-h-[108px] rounded-2xl border border-emerald-100 bg-white/80 px-4 py-4 backdrop-blur-sm">
                    {aiRecommendationState === 'analyzing' && (
                      <div className="flex items-start gap-3 animate-in fade-in duration-300">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                          <Sparkles className="h-5 w-5 animate-pulse" />
                        </div>
                        <div className="flex-1 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            {recommendation.header}
                          </p>
                          <div className="mt-2 flex items-center gap-1 text-base font-medium text-slate-900">
                            <span>{language === 'tl' ? 'Inihahanda ang rekomendasyon' : 'Preparing the recommendation'}</span>
                            <span className="animate-pulse [animation-delay:0ms]">.</span>
                            <span className="animate-pulse [animation-delay:150ms]">.</span>
                            <span className="animate-pulse [animation-delay:300ms]">.</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {(aiRecommendationState === 'typing' || aiRecommendationState === 'done') && (
                      <div className="animate-in fade-in duration-500">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-black shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                              <Sparkles className="h-5 w-5" />
                            </div>
                            <div>
                              {aiRecommendationRevealStep >= 1 && (
                                <p className="animate-in fade-in slide-in-from-bottom-1 duration-300 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                                  {typedAiRecommendationHeader}
                                  {aiRecommendationRevealStep === 1 && typedAiRecommendationHeader.length < recommendation.header.length && (
                                    <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-emerald-600 align-middle" />
                                  )}
                                </p>
                              )}
                              {aiRecommendationRevealStep >= 2 && (
                                <p className="animate-in fade-in slide-in-from-bottom-1 duration-300 text-sm text-slate-600">
                                  {typedAiRecommendationSubtitle}
                                  {aiRecommendationRevealStep === 2 && typedAiRecommendationSubtitle.length < recommendation.subtitle.length && (
                                    <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-emerald-600 align-middle" />
                                  )}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 space-y-2">
                            {aiRecommendationRevealStep >= 3 && (
                              <p className="animate-in fade-in slide-in-from-bottom-1 duration-300 text-sm font-semibold text-black">
                                {typedDiagnosisLine}
                                {aiRecommendationRevealStep === 3 && typedDiagnosisLine.length < `${language === 'tl' ? '🧠 Diagnosis' : '🧠 Diagnosis'}: ${displayDiseaseName || 'Leaf Curl'}`.length && (
                                  <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-emerald-600 align-middle" />
                                )}
                              </p>
                            )}
                            {aiRecommendationRevealStep >= 4 && (
                              <p className="animate-in fade-in slide-in-from-bottom-1 duration-300 text-sm font-semibold text-black">
                                {typedRiskLine}
                                {aiRecommendationRevealStep === 4 && typedRiskLine.length < `${language === 'tl' ? '🔴 Antas ng Panganib' : '🔴 Risk Level'}: ${getRiskLevelLabel(result.severity)}`.length && (
                                  <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-emerald-600 align-middle" />
                                )}
                              </p>
                            )}
                            {aiRecommendationRevealStep >= 5 && (
                              <p className="animate-in fade-in slide-in-from-bottom-1 duration-300 text-sm font-semibold text-black">
                                {typedActionLine}
                                {aiRecommendationRevealStep === 5 && typedActionLine.length < `${language === 'tl' ? '⚡ Kailangang Aksyon' : '⚡ Action Required'}: ${getActionRequiredLabel(result.severity)}`.length && (
                                  <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-emerald-600 align-middle" />
                                )}
                              </p>
                            )}
                          </div>

                          {aiRecommendationRevealStep >= 6 && (
                            <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                              <p className="text-sm font-semibold text-black">
                                {recommendation.insightLabel}
                              </p>
                              <p className="mt-2 text-sm leading-7 text-black">
                                {typedRecommendation}
                                {aiRecommendationState === 'typing' && (
                                  <span className="ml-0.5 inline-block h-5 w-[2px] animate-pulse bg-emerald-600 align-middle" />
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {aiRecommendation && aiRecommendationState === 'done' && (
                      <div className="mt-4 space-y-3 border-t border-emerald-100 pt-4 text-sm text-slate-700">
                        {aiRecommendation.notice && (
                          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">{aiRecommendation.notice}</p>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <p><span className="font-semibold text-slate-900">AI Preliminary Severity Assessment:</span> {aiRecommendation.severity?.level || (language === 'tl' ? 'Hindi maaasahang matukoy mula sa larawan' : 'Cannot be reliably assessed from this image')}</p>
                          {aiRecommendation.severity?.reason && (
                            <p className="sm:col-span-2 text-xs text-slate-500"><span className="font-semibold text-slate-700">{language === 'tl' ? 'Batayan' : 'Reason'}:</span> {aiRecommendation.severity.reason}</p>
                          )}
                          <p className="sm:col-span-2"><span className="font-semibold text-slate-900">{language === 'tl' ? 'Kondisyon' : 'Condition'}:</span> {aiRecommendation.stage?.label || (language === 'tl' ? 'Hindi maaasahang matukoy mula sa larawan' : 'Cannot be reliably determined from this image')}</p>
                        </div>
                        {[
                          [language === 'tl' ? 'Gawin Ngayon' : 'Do Now', aiRecommendation.immediate_actions],
                          [language === 'tl' ? 'Pag-iwas' : 'Prevention', aiRecommendation.prevention],
                          [language === 'tl' ? 'Babantayan' : 'Monitor', aiRecommendation.monitoring],
                          [language === 'tl' ? 'Environmental Advice' : 'Environmental Advice', aiRecommendation.environmental_advice],
                        ].map(([title, items]) => Array.isArray(items) && items.length > 0 && (
                          <div key={title}>
                            <p className="font-semibold text-slate-900">{title}</p>
                            <ul className="mt-1 space-y-1">{items.slice(0, 3).map((item) => <li key={item} className="flex gap-2"><span className="text-emerald-600">•</span><span>{item}</span></li>)}</ul>
                          </div>
                        ))}
                        <div>
                          <p className="font-semibold text-slate-900">Treatment</p>
                          {Array.isArray(aiRecommendation.treatment?.details) && aiRecommendation.treatment.details.length > 0 ? (
                            <ul className="mt-1 space-y-1">
                              {aiRecommendation.treatment.details.slice(0, 3).map((item) => (
                                <li key={item} className="flex gap-2"><span className="text-emerald-600">•</span><span>{item}</span></li>
                              ))}
                            </ul>
                          ) : (
                            <p>{language === 'tl' ? 'Walang treatment details na available.' : 'No treatment details are available.'}</p>
                          )}
                          {aiRecommendation.chemical_treatment?.message && (
                            <p className="mt-1 text-xs text-slate-500">{aiRecommendation.chemical_treatment.message}</p>
                          )}
                        </div>
                        <div><p className="font-semibold text-slate-900">{language === 'tl' ? 'Kailan Kumonsulta?' : 'When to seek help'}</p><p>{aiRecommendation.when_to_seek_help}</p></div>
                        <div><p className="font-semibold text-slate-900">{language === 'tl' ? 'Kaligtasan' : 'Safety'}</p><p>{aiRecommendation.safety_precautions?.[0]}</p></div>
                      </div>
                    )}

                    {aiRecommendationState === 'idle' && (
                      <div className="rounded-2xl border border-dashed border-emerald-200 bg-white px-4 py-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                          {recommendation.header}
                        </p>
                        <p className="mt-2 text-base leading-8 text-slate-700">
                          {language === 'tl'
                            ? 'Hinihintay ang resulta bago magbigay ng rekomendasyon.'
                            : 'Waiting for the result before preparing a recommendation.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Guide */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 shadow-lg border-2 border-emerald-200">
        <CardHeader>
          <CardTitle className="text-gray-900">{t.tips}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg">
                  <Camera className="w-5 h-5 text-emerald-600" />
                </div>
              <div>
                <h4 className="text-sm text-gray-900 mb-1">{t.goodLighting}</h4>
                <p className="text-xs text-gray-600">{t.goodLightingDesc}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg">
                <Leaf className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-sm text-gray-900 mb-1">{t.clearFocus}</h4>
                <p className="text-xs text-gray-600">{t.clearFocusDesc}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h4 className="text-sm text-gray-900 mb-1">{t.captureSymptoms}</h4>
                <p className="text-xs text-gray-600">{t.captureSymptomsDesc}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showCamera} onOpenChange={(open) => !open && closeCamera()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.captureLeafPhoto}</DialogTitle>
            <DialogDescription>
              {t.positionLeaf}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-auto"
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
            <div className="scan-actions">
              <Button type="button" variant="outline" onClick={closeCamera}>
                {t.cancel}
              </Button>
              <Button
                type="button"
                onClick={capturePhoto}
                className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
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
