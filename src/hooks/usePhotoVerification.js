//  src/hooks/usePhotoVerification.js
import { useState } from "react";
import { invokeWithAuth } from "../lib/invokeWithAuth";

export function usePhotoVerification() {

    const [result, setResult] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState(null);

    async function verifyPhoto(image) {

        setVerifying(true);
        setError(null);
        setResult(null);

        try {

        const { data, error } = await invokeWithAuth(
            "public-photo-search",
            {
                body: { imageUrl: image }
            }
        );

        if (error || !data?.success) {
            throw new Error(data?.message || "Photo verification failed");
        }

        if (!data.found) {
            setResult({
                state: "NOT_FOUND"
            });

            return;
        }

        const item = data.item;

        setResult({
            state: item.status === "STOLEN" ? "STOLEN" : "REGISTERED",
            itemId: item.id,
            category: item.category,
            make: item.make,
            model: item.model,
            reported: item.reported
        });

        } catch (err) {
            setError(err.message || "Photo verification failed");
        } finally {
            setVerifying(false);
        }
    }

    function reset() {
        setResult(null);
        setError(null);
    }

    return {
        result,
        verifying,
        error,
        verifyPhoto,
        reset
    };
}