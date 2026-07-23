import { useEffect, useState } from "react";
import { ratiosApi } from "../services/api";

/**
 * Mức tính mặc định theo giới tính khi chưa tải được bảng `ratios`.
 * Khớp với RatioSeeder ở backend: Nam = 1, Nữ = 0.7.
 */
export const FALLBACK_GENDER_RATIO = { male: 1, female: 0.7 };

export const ratioForGender = (map, gender) =>
  map?.[gender] ?? FALLBACK_GENDER_RATIO[gender] ?? 1;

/**
 * Trả về map { male, female } mức tính mặc định, lấy từ bảng `ratios` (bản ghi is_default).
 * Dùng cho form "Thêm nhanh người chơi": đổi giới tính thì mức tính tự set theo mặc định.
 */
export function useGenderDefaultRatios() {
  const [ratios, setRatios] = useState(FALLBACK_GENDER_RATIO);

  useEffect(() => {
    let cancelled = false;
    ratiosApi
      .getAll()
      .then((res) => {
        if (cancelled) return;
        const map = { ...FALLBACK_GENDER_RATIO };
        (res.data || []).forEach((r) => {
          if (r.is_default && r.gender) map[r.gender] = Number(r.value);
        });
        setRatios(map);
      })
      .catch((e) => console.error("Error loading default ratios:", e));
    return () => {
      cancelled = true;
    };
  }, []);

  return ratios;
}
