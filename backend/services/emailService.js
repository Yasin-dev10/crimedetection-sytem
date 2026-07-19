const nodemailer = require("nodemailer");
const {
  buildCaseAssignmentEmailHtml,
  getCaseAssignmentDetails,
} = require("./caseAssignmentNotifications");

const emailUser = (process.env.EMAIL_USER || "").trim();
const emailPass = (process.env.EMAIL_PASS || "").replace(/\s/g, "");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});

const getSender = (label = "BAAREAI") => `"${label}" <${emailUser}>`;

const sendEmailAlert = async ({
  to,
  subject,
  message,
}) => {
  try {
    await transporter.sendMail({
      from: getSender("BAAREAI Alert"),
      to,
      subject,
      html: `
        <h2>BAAREAI Crime Alert</h2>
        <p>${message}</p>
      `,
    });

    console.log("EMAIL SENT:", to);
  } catch (error) {
    console.error("EMAIL ERROR:", error.message);
  }
};

const sendVerificationEmail = async (to, verificationToken, userName) => {
  try {
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">BAAREAI - Email Verification</h2>
        <p>Hello ${userName},</p>
        <p>Thank you for joining BAAREAI. Please verify your email address to complete your registration.</p>
        <p style="margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Verify Email Address
          </a>
        </p>
        <p>Or copy this link in your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationLink}</p>
        <p style="color: #666; font-size: 12px;">This verification link will expire in 24 hours.</p>
      </div>
    `;

    await transporter.sendMail({
      from: getSender(),
      to,
      subject: "BAAREAI - Email Verification Required",
      html: htmlContent,
    });

    console.log("VERIFICATION EMAIL SENT:", to);
  } catch (error) {
    console.error("EMAIL ERROR:", error.message);
    throw error;
  }
};

const sendCredentialsEmail = async (to, userName, password, role) => {
  try {
    const loginLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">BAAREAI - Your Account Credentials</h2>
        <p>Hello ${userName},</p>
        <p>Your ${role} account has been created successfully. Here are your login credentials:</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Email:</strong> ${to}</p>
          <p><strong>Password:</strong> ${password}</p>
          <p><strong>Role:</strong> ${role}</p>
        </div>

        <p style="color: #d32f2f; font-weight: bold;">⚠️ IMPORTANT:</p>
        <ul>
          <li>Please change your password immediately after your first login</li>
          <li>Keep your credentials secure and confidential</li>
          <li>Do not share your password with anyone</li>
        </ul>

        <p style="margin: 30px 0;">
          <a href="${loginLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Login to BAAREAI
          </a>
        </p>

        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          If you did not create this account, please contact support immediately.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: getSender(),
      to,
      subject: "BAAREAI - Your Login Credentials",
      html: htmlContent,
    });

    console.log("CREDENTIALS EMAIL SENT:", to);
  } catch (error) {
    console.error("EMAIL ERROR:", error.message);
    throw error;
  }
};

const sendOTPEmail = async (to, otpCode, userName) => {
  try {
    const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?email=${encodeURIComponent(to)}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #0891b2); padding: 16px; border-radius: 12px; font-size: 28px; font-weight: 900; color: #fff; letter-spacing: 2px;">
            BAAREAI
          </div>
        </div>

        <h2 style="color: #f1f5f9; font-size: 22px; margin-bottom: 8px;">Email Verification Code</h2>
        <p style="color: #94a3b8; margin-bottom: 32px;">Hello <strong style="color: #e2e8f0;">${userName}</strong>, use the code below to verify your email address.</p>

        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 32px;">
          <p style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">Your Verification Code</p>
          <div style="font-size: 48px; font-weight: 900; letter-spacing: 12px; color: #06b6d4; font-family: monospace;">
            ${otpCode}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">⏱ This code expires in <strong>15 minutes</strong></p>
        </div>

        <p style="color: #94a3b8; margin-bottom: 20px;">Click the button below to go to the verification page, then enter your email and the code above.</p>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${verifyLink}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #0891b2); color: #fff; font-weight: 700; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-size: 15px;">
            Go to Verification Page →
          </a>
        </div>

        <div style="background: #1e293b; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
          <p style="color: #fbbf24; font-size: 13px; margin: 0;">
            ⚠️ Do not share this code with anyone. BAAREAI staff will never ask for this code.
          </p>
        </div>

        <p style="color: #475569; font-size: 12px; text-align: center;">
          If you did not create an account with BAAREAI, please ignore this email.
        </p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: getSender(),
      to,
      subject: "BAAREAI - Your Verification Code",
      html: htmlContent,
    });

    console.log("OTP EMAIL SENT:", to, {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });
  } catch (error) {
    console.error("EMAIL ERROR:", error.message);
    throw error;
  }
};

// Send a single email containing both the OTP verification code AND the generated password
const sendOTPWithPasswordEmail = async (to, otpCode, password, userName, role) => {
  try {
    const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?email=${encodeURIComponent(to)}`;
    const loginLink  = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #0891b2); padding: 14px 24px; border-radius: 12px; font-size: 26px; font-weight: 900; color: #fff; letter-spacing: 2px;">
            BAAREAI
          </div>
        </div>

        <h2 style="color: #f1f5f9; font-size: 22px; margin-bottom: 6px;">Account Created — Verify Your Email</h2>
        <p style="color: #94a3b8; margin-bottom: 32px;">
          Hello <strong style="color: #e2e8f0;">${userName}</strong>, your <strong style="color: #06b6d4;">${role}</strong> account has been created.
          Below you will find everything you need to get started.
        </p>

        <!-- OTP Section -->
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 28px; text-align: center; margin-bottom: 24px;">
          <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">Step 1 — Email Verification Code</p>
          <div style="font-size: 46px; font-weight: 900; letter-spacing: 12px; color: #06b6d4; font-family: monospace;">
            ${otpCode}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 12px;">⏱ Expires in <strong>15 minutes</strong></p>
        </div>

        <!-- Verify button -->
        <div style="text-align: center; margin-bottom: 28px;">
          <a href="${verifyLink}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #0891b2); color: #fff; font-weight: 700; padding: 13px 30px; border-radius: 10px; text-decoration: none; font-size: 14px;">
            Verify Email Now →
          </a>
        </div>

        <!-- Divider -->
        <div style="border-top: 1px solid #1e293b; margin-bottom: 24px;"></div>

        <!-- Credentials Section -->
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">Step 2 — Your Login Credentials</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="color: #64748b; font-size: 13px; padding: 8px 0; width: 90px;">Email</td>
              <td style="color: #e2e8f0; font-size: 13px; font-weight: 600; padding: 8px 0;">${to}</td>
            </tr>
            <tr>
              <td style="color: #64748b; font-size: 13px; padding: 8px 0;">Password</td>
              <td style="color: #06b6d4; font-size: 15px; font-weight: 900; font-family: monospace; padding: 8px 0; letter-spacing: 1px;">${password}</td>
            </tr>
            <tr>
              <td style="color: #64748b; font-size: 13px; padding: 8px 0;">Role</td>
              <td style="color: #e2e8f0; font-size: 13px; font-weight: 600; padding: 8px 0; text-transform: capitalize;">${role}</td>
            </tr>
          </table>
        </div>

        <!-- Login button -->
        <div style="text-align: center; margin-bottom: 28px;">
          <a href="${loginLink}" style="display: inline-block; background: #1e293b; border: 1px solid #334155; color: #e2e8f0; font-weight: 600; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-size: 14px;">
            Go to Login →
          </a>
        </div>

        <!-- Warning -->
        <div style="background: #1e293b; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 14px 16px; margin-bottom: 24px;">
          <p style="color: #fbbf24; font-size: 12px; margin: 0;">
            ⚠️ Keep your password secure. Please change it after your first login. BAAREAI staff will never ask for your password.
          </p>
        </div>

        <p style="color: #475569; font-size: 11px; text-align: center;">
          If you did not create an account with BAAREAI, please ignore this email.
        </p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: getSender(),
      to,
      subject: "BAAREAI - Your Account Credentials & Verification Code",
      html: htmlContent,
    });

    console.log("OTP+PASSWORD EMAIL SENT:", to, {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });
  } catch (error) {
    console.error("EMAIL ERROR:", error.message);
    throw error;
  }
};

const sendLoginOTPEmail = async (to, otpCode, userName) => {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 16px; border-radius: 12px; font-size: 28px; font-weight: 900; color: #fff; letter-spacing: 2px;">
            BAAREAI
          </div>
        </div>

        <h2 style="color: #f1f5f9; font-size: 22px; margin-bottom: 8px;">Login Verification Code</h2>
        <p style="color: #94a3b8; margin-bottom: 32px;">Hello <strong style="color: #e2e8f0;">${userName}</strong>, use the code below to complete your login.</p>

        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 32px;">
          <p style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">Your Login Code</p>
          <div style="font-size: 48px; font-weight: 900; letter-spacing: 12px; color: #818cf8; font-family: monospace;">
            ${otpCode}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">⏱ This code expires in <strong>15 minutes</strong></p>
        </div>

        <div style="background: #1e293b; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
          <p style="color: #fbbf24; font-size: 13px; margin: 0;">
            ⚠️ Do not share this code with anyone. BAAREAI staff will never ask for this code.
          </p>
        </div>

        <p style="color: #475569; font-size: 12px; text-align: center;">
          If you did not attempt to log in, please secure your account immediately.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: getSender(),
      to,
      subject: "BAAREAI - Your Login Verification Code",
      html: htmlContent,
    });

    console.log("LOGIN OTP EMAIL SENT:", to);
  } catch (error) {
    console.error("EMAIL ERROR:", error.message);
    throw error;
  }
};

const sendPasswordResetOTPEmail = async (to, otpCode, userName) => {
  try {
    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/forgot-password?email=${encodeURIComponent(to)}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); padding: 16px; border-radius: 12px; font-size: 28px; font-weight: 900; color: #fff; letter-spacing: 2px;">
            BAAREAI
          </div>
        </div>

        <h2 style="color: #f1f5f9; font-size: 22px; margin-bottom: 8px;">Password Reset Code</h2>
        <p style="color: #94a3b8; margin-bottom: 32px;">Hello <strong style="color: #e2e8f0;">${userName}</strong>, use the code below to reset your password.</p>

        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; text-align: center; margin-bottom: 32px;">
          <p style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">Your Reset Code</p>
          <div style="font-size: 48px; font-weight: 900; letter-spacing: 12px; color: #f59e0b; font-family: monospace;">
            ${otpCode}
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">⏱ This code expires in <strong>15 minutes</strong></p>
        </div>

        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; font-weight: 700; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-size: 15px;">
            Reset Password →
          </a>
        </div>

        <div style="background: #1e293b; border-left: 4px solid #ef4444; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
          <p style="color: #fca5a5; font-size: 13px; margin: 0;">
            ⚠️ If you did not request a password reset, ignore this email and secure your account.
          </p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: getSender(),
      to,
      subject: "BAAREAI - Password Reset Code",
      html: htmlContent,
    });

    console.log("PASSWORD RESET OTP EMAIL SENT:", to);
  } catch (error) {
    console.error("EMAIL ERROR:", error.message);
    throw error;
  }
};

const sendPasswordChangeVerificationEmail = async (to, changeToken, userName) => {
  try {
    const changeLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/change-password?token=${changeToken}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">BAAREAI - Password Change Verification</h2>
        <p>Hello ${userName},</p>
        <p>We received a request to change your password. Please click the link below to verify and proceed:</p>
        
        <p style="margin: 30px 0;">
          <a href="${changeLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Verify and Change Password
          </a>
        </p>
        
        <p>Or copy this link in your browser:</p>
        <p style="word-break: break-all; color: #666;">${changeLink}</p>
        
        <p style="color: #666; font-size: 12px;">This link will expire in 1 hour.</p>
        <p style="color: #666; font-size: 12px;">If you did not request this change, please ignore this email.</p>
      </div>
    `;

    await transporter.sendMail({
      from: getSender(),
      to,
      subject: "BAAREAI - Password Change Verification",
      html: htmlContent,
    });

    console.log("PASSWORD CHANGE EMAIL SENT:", to);
  } catch (error) {
    console.error("EMAIL ERROR:", error.message);
    throw error;
  }
};

const sendCaseAssignmentEmail = async ({ to, officer, investigationCase }) => {
  try {
    if (!to) return;

    const details = getCaseAssignmentDetails(investigationCase, officer);

    await transporter.sendMail({
      from: getSender("BAAREAI Investigations"),
      to,
      subject: `BAAREAI — New Case Assigned (${details.category})`,
      html: buildCaseAssignmentEmailHtml(investigationCase, officer),
    });

    console.log("CASE ASSIGNMENT EMAIL SENT:", to);
  } catch (error) {
    console.error("CASE ASSIGNMENT EMAIL ERROR:", error.message);
    throw error;
  }
};

module.exports = {
  sendEmailAlert,
  sendVerificationEmail,
  sendOTPEmail,
  sendOTPWithPasswordEmail,
  sendLoginOTPEmail,
  sendPasswordResetOTPEmail,
  sendCredentialsEmail,
  sendPasswordChangeVerificationEmail,
  sendCaseAssignmentEmail,
};
