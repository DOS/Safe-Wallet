import React from 'react'
import { Typography } from '@mui/material'
import css from './styles.module.css'
import WelcomeLogin from './WelcomeLogin'
import SafeLabsLogo from '@/public/images/logo-safe-labs.svg'
import { BRAND_LOGO, BRAND_NAME, IS_OFFICIAL_HOST } from '@/config/constants'
import footerCss from './welcomeFooter.module.css'
import Footer from '../common/Footer'

const NewSafe = () => {
  return (
    <div className={css.loginPage}>
      <div className={css.leftSide}>
        <div className={css.logoContainer}>
          {IS_OFFICIAL_HOST ? (
            <SafeLabsLogo className={css.logo} />
          ) : BRAND_LOGO ? (
            <img src={BRAND_LOGO} alt={BRAND_NAME} className={css.logo} />
          ) : (
            <SafeLabsLogo className={css.logo} />
          )}
        </div>
        <div className={css.loginContainer}>
          <WelcomeLogin />
        </div>
        <Footer forceShow versionIcon={false} helpCenter={false} preferences={false} className={footerCss.footer} />
      </div>

      <div className={css.rightSide}>
        <div className={css.rightContent}>
          <Typography className={css.label}>FOR ORGANIZATIONS AND POWER USERS</Typography>
          <Typography className={css.mainTitle}>Own your assets onchain securely</Typography>
        </div>
        <div className={css.mockupImageContainer}>
          <img src="/images/welcome/safe-mockup.png" alt="Safe interface mockup" className={css.mockupImage} />
        </div>
      </div>
    </div>
  )
}

export default NewSafe
