// 📁 src/hooks/useUserNotifications.js
export function useUserNotifications() {

  const { user } = useAuth();

  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  async function fetchNotifications() {

    setLoading(true);

    const { data: res, error } = await invokeWithAuth(
      "get-notifications",
      {
        body: {
          limit: 50,
          page: 1
        }
      }
    );

    if (!error && res?.success) {

      const list = res.notifications || [];

      setNotifications(list);
      setTotal(list.length);
      setUnread(list.filter(n => !n.isread).length);
    }

    setLoading(false);
  }

  useEffect(() => {

    if (!user?.id) return;

    fetchNotifications();

  }, [user?.id]);

  return {
    notifications,
    total,
    unread,
    loading,
    refreshNotifications: fetchNotifications,
  };
}