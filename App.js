import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInAnonymously 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  addDoc,
  arrayUnion, 
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Home, 
  Search, 
  PlusSquare, 
  Trophy, 
  User, 
  Heart, 
  MessageCircle, 
  MoreHorizontal,
  Bookmark,
  Send,
  X,
  Camera,
  Settings,
  Loader2,
  Utensils,
  Flame,
  Target,
  Trash2,
  Pencil
} from 'lucide-react';

// --- 片山さんのFirebase設定を反映 ---
const firebaseConfig = {
  apiKey: "AIzaSyB9BF6SriC2Rqk2q8LSjb2BBH_iMv64cio",
  authDomain: "my-recipe-app-f71a8.firebaseapp.com",
  projectId: "my-recipe-app-f71a8",
  storageBucket: "my-recipe-app-f71a8.firebasestorage.app",
  messagingSenderId: "790810134726",
  appId: "1:790810134726:web:85aa63146321cddfdc6fc7",
  measurementId: "G-P0LJWYCBG9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'recipe-sns-app';

// --- アプリの基本設定 ---
const GENRES = [
  { id: 'all', name: 'すべて', icon: <Utensils size={18} /> },
  { id: 'jp', name: '和食', icon: '🍱' },
  { id: 'western', name: '洋食', icon: '🍝' },
  { id: 'cn', name: '中華', icon: '🥟' },
  { id: 'asian', name: 'エスニック', icon: '🍛' },
  { id: 'bento', name: '弁当', icon: '🍙' },
  { id: 'easy', name: '時短', icon: '⏱️' },
  { id: 'muscle', name: '筋トレ', icon: <Flame size={16} /> },
  { id: 'diet', name: 'ダイエット', icon: <Target size={16} /> },
  { id: 'other', name: 'その他', icon: '🍴' },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [posts, setPosts] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState(null);
  
  const [editingPost, setEditingPost] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formGenre, setFormGenre] = useState('jp');
  const [formIngredients, setFormIngredients] = useState('');
  const [formSteps, setFormSteps] = useState(Array(5).fill({ text: '', imageUrl: '' }));
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedPost, setExpandedPost] = useState(null);

  const fileInputRefs = useRef([]);
  const profileImageInputRef = useRef(null);

  // ログイン処理
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        await signInAnonymously(auth);
      } else {
        setUser(u);
        const userDocRef = doc(db, 'users', u.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          } else {
            const initialData = {
              uid: u.uid,
              displayName: `Chef_${u.uid.slice(0, 4)}`,
              photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`,
              createdAt: serverTimestamp()
            };
            setDoc(userDocRef, initialData);
            setUserProfile(initialData);
          }
        });
        return () => unsubscribeProfile();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // 投稿の同期
  useEffect(() => {
    if (!user) return;
    const postsCol = collection(db, 'posts');
    const unsubscribe = onSnapshot(postsCol, (snapshot) => {
      const p = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(p.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
    });
    return () => unsubscribe();
  }, [user]);

  // コメントの同期
  useEffect(() => {
    if (!user || !selectedPostForComments) {
      setComments([]);
      return;
    }
    const commentsCol = collection(db, 'posts', selectedPostForComments.id, 'comments');
    const unsubscribe = onSnapshot(commentsCol, (snapshot) => {
      const c = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComments(c.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)));
    });
    return () => unsubscribe();
  }, [user, selectedPostForComments]);

  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!user || isProcessing) return;
    setIsProcessing(true);
    const finalSteps = formSteps.filter(s => s.text.trim() !== '');
    const postData = {
      title: formTitle,
      genre: formGenre,
      ingredients: formIngredients.split(',').map(i => i.trim()),
      steps: finalSteps,
      authorId: user.uid,
      authorName: userProfile?.displayName || 'Chef',
      authorPhotoURL: userProfile?.photoURL || '',
      updatedAt: serverTimestamp(),
      imageUrl: `https://loremflickr.com/600/400/food?lock=${Math.floor(Math.random() * 1000)}`
    };
    try {
      if (editingPost) {
        await updateDoc(doc(db, 'posts', editingPost.id), postData);
      } else {
        await addDoc(collection(db, 'posts'), {
          ...postData,
          likes: [],
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (error) { console.error(error); }
    setIsProcessing(false);
  };

  const handleLike = async (postId, currentLikes) => {
    if (!user) return;
    const postRef = doc(db, 'posts', postId);
    const isLiked = currentLikes?.includes(user.uid);
    await updateDoc(postRef, {
      likes: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
    });
  };

  const filteredPosts = useMemo(() => {
    return posts.filter(p => {
      const matchesGenre = selectedGenre === 'all' || p.genre === selectedGenre;
      const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesGenre && matchesSearch;
    });
  }, [posts, selectedGenre, searchQuery]);

  // UIの一部（ホーム画面）
  const HomeView = () => (
    <div className="pb-16 bg-white">
      <div className="flex overflow-x-auto px-4 py-3 gap-4 border-b border-gray-50 bg-white sticky top-0 z-10 no-scrollbar">
        {GENRES.map(g => (
          <button key={g.id} onClick={() => setSelectedGenre(g.id)} className="flex flex-col items-center flex-shrink-0">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg border-2 ${selectedGenre === g.id ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
              {g.icon}
            </div>
            <span className="text-[10px] mt-1">{g.name}</span>
          </button>
        ))}
      </div>
      <div className="divide-y divide-gray-100">
        {filteredPosts.map(post => (
          <div key={post.id} className="bg-white">
            <div className="flex items-center p-3 gap-3">
              <img src={post.authorPhotoURL} className="w-8 h-8 rounded-full" />
              <p className="font-semibold text-xs">{post.authorName}</p>
            </div>
            <img src={post.imageUrl} className="w-full aspect-square object-cover" />
            <div className="p-3">
              <div className="flex gap-4 mb-2">
                <Heart onClick={() => handleLike(post.id, post.likes)} size={24} className={post.likes?.includes(user?.uid) ? "fill-red-500 text-red-500" : ""} />
                <MessageCircle onClick={() => setSelectedPostForComments(post)} size={24} />
              </div>
              <p className="font-bold text-xs mb-1">いいね！ {post.likes?.length || 0}件</p>
              <p className="text-xs font-bold">{post.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen relative font-sans text-gray-900 overflow-x-hidden">
      <header className="bg-white p-3 flex items-center justify-between sticky top-0 z-30 border-b border-gray-50">
        <h1 className="text-xl font-bold italic text-orange-500">RecipiLink</h1>
        <PlusSquare onClick={() => setIsModalOpen(true)} size={24} />
      </header>

      <main className="min-h-screen">
        {activeTab === 'home' && <HomeView />}
        {activeTab === 'profile' && <div className="p-10 text-center">プロフィール画面（開発中）</div>}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-gray-100 py-2 flex justify-around items-center z-40">
        <Home onClick={() => setActiveTab('home')} size={24} color={activeTab === 'home' ? 'orange' : 'gray'} />
        <Search size={24} color="gray" />
        <Trophy size={24} color="gray" />
        <User onClick={() => setActiveTab('profile')} size={24} color={activeTab === 'profile' ? 'orange' : 'gray'} />
      </nav>

      {/* 投稿モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4">
              <button onClick={() => setIsModalOpen(false)}>キャンセル</button>
              <button onClick={handleSavePost} className="font-bold text-blue-500">投稿する</button>
            </div>
            <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="料理の名前" className="w-full text-lg font-bold border-b p-2 mb-4 outline-none" />
            <textarea value={formIngredients} onChange={e => setFormIngredients(e.target.value)} placeholder="材料（例: 玉ねぎ, 牛肉）" className="w-full h-24 p-2 bg-gray-50 rounded-xl mb-4 outline-none" />
            <p className="text-sm text-gray-400 mb-2">※写真は自動でランダムな料理画像が設定されます</p>
          </div>
        </div>
      )}
    </div>
  );
}
