//  supabase/functions/shared/generateEmbedding.ts
export async function generateEmbedding(
  imageUrl: string,
  replicateToken: string
): Promise<number[]> {

    const replicateRes = await fetch(
        "https://api.replicate.com/v1/predictions",
        {
        method: "POST",
        headers: {
            "Authorization": `Token ${replicateToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            version:
            "4d38f0d7c0a2b64e3a83d3673d299c24c45ea1ab696648efa7a4182a26c6f2a5",
            input: {
            image: imageUrl
            }
        })
        }
    )

    const prediction = await replicateRes.json()

    if (!prediction?.urls?.get) {
        throw new Error("Embedding generation failed")
    }

    let embedding: number[] | null = null
    let attempts = 0

    while (!embedding && attempts < 30) {

        const poll = await fetch(prediction.urls.get, {
            headers: {
                Authorization: `Token ${replicateToken}`
            }
        })

        const pollData = await poll.json()

        if (pollData.status === "succeeded") {
            embedding = Array.isArray(pollData.output)
                ? pollData.output
                : pollData.output?.embedding
        }

        if (pollData.status === "failed") {
            throw new Error("Embedding generation failed")
        }

        attempts++

        await new Promise(r => setTimeout(r, 1000))
    }

    if (!embedding) {
        throw new Error("Embedding generation timeout")
    }

    return embedding
}