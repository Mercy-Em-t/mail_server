import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

export async function GET() {
    try {
        const result = await cloudinary.search
            .expression('folder:nexus_cms_uploads')
            .sort_by('created_at', 'desc')
            .max_results(30)
            .execute();
            
        const fileUrls = result.resources.map((file: any) => file.secure_url);
        return NextResponse.json({ success: true, media: fileUrls });
    } catch (err) {
        console.error('Cloudinary fetch error:', err);
        return NextResponse.json({ success: false, message: 'Unable to fetch media from Cloudinary.' }, { status: 500 });
    }
}
