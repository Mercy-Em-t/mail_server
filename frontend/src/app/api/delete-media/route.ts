import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

export async function POST(request: Request) {
    try {
        const { url } = await request.json();
        
        const urlParts = url.split('/');
        const fileWithExt = urlParts[urlParts.length - 1];
        const folder = urlParts[urlParts.length - 2]; 
        const filename = fileWithExt.split('.')[0];
        const publicId = `${folder}/${filename}`;
        
        // Soft delete: rename/move to a trash folder
        const trashPublicId = `nexus_cms_trash/${filename}-${Date.now()}`;
        await cloudinary.uploader.rename(publicId, trashPublicId);
        
        return NextResponse.json({ success: true, message: 'Asset archived safely.' });
    } catch (err) {
        console.error('Soft delete error:', err);
        return NextResponse.json({ success: false, message: 'Failed to archive asset.' }, { status: 500 });
    }
}
